module Recommendations
  # Deterministic, rule-based ranking of a user's watchlist for one viewing window.
  #
  # Pipeline: pool -> hard constraints -> feature scores -> rank -> diversity -> shortlist -> explanations.
  #
  # Hard constraints are never traded off against scores: with "single_sitting" or
  # "continue_started", anything whose (remaining) runtime exceeds the window, or whose runtime
  # is unknown, is excluded no matter how well it matches otherwise.
  #
  # Scoring: each component is normalised to 0..1, and only components with a real signal for
  # this request are used. Their weights are re-normalised to sum to 1, so a missing optional
  # preference redistributes its weight proportionally instead of counting as zero.
  class Engine
    VERSION = "rules-v1".freeze

    # Starting values, not tuned. Change here; recorded per item so sessions stay comparable.
    WEIGHTS = {
      genre: 0.40,
      runtime: 0.30,
      priority: 0.20,
      mood: 0.15,
      personal_interest: 0.10
    }.freeze

    # Runtime fit: a movie using 60–90% of the window scores 1.0 (it fits with some buffer).
    IDEAL_MIN_RATIO = 0.6
    IDEAL_MAX_RATIO = 0.9
    # Used when runtime is unknown and the request is not strict (open_to_longer).
    NEUTRAL_SCORE = 0.5
    # Greedy diversity: penalise a candidate by its highest genre overlap (Jaccard) with picks so far.
    DIVERSITY_PENALTY = 0.15
    DEFAULT_LIMIT = 3
    MAX_LIMIT = 5

    # Mood is matched through genres only — that's the only mood signal the metadata supports.
    MOOD_GENRES = {
      "lighthearted" => ["Comedy", "Animation", "Family", "Romance"],
      "exciting" => ["Action", "Adventure", "Science Fiction", "Thriller"],
      "thought_provoking" => ["Drama", "Documentary", "Science Fiction", "Mystery", "History"],
      "emotional" => ["Drama", "Romance", "Music", "War"],
      "suspenseful" => ["Thriller", "Mystery", "Horror", "Crime"],
      "comfort" => ["Comedy", "Family", "Animation", "Romance", "Music"]
    }.freeze
    MOOD_LABELS = {
      "lighthearted" => "lighthearted", "exciting" => "exciting", "thought_provoking" => "thought-provoking",
      "emotional" => "emotional", "suspenseful" => "suspenseful", "comfort" => "comfort-watch"
    }.freeze

    BASE_STATUSES = %w[want_to_watch watching paused].freeze
    STARTED_STATUSES = %w[watching paused].freeze

    # viewing_context is recorded but deliberately not scored: without age ratings or content
    # data there is no honest rule for "family" or "date night" yet.
    # availability: "anywhere" | "free" | "free_or_subscribed", evaluated in `region`.
    Request = Struct.new(:available_minutes, :mood, :genre_ids, :viewing_context,
                         :completion_preference, :include_abandoned, :limit,
                         :availability, :region, :subscribed_provider_ids, keyword_init: true)
    Candidate = Struct.new(:item, :movie, :genre_ids, :genre_names, :minutes, :continuing,
                           :score, :components, keyword_init: true)
    Pick = Struct.new(:candidate, :rank, :headline, :explanations, keyword_init: true)
    Result = Struct.new(:eligible_count, :pool_count, :exclusions, :picks, keyword_init: true)

    def initialize(user, request)
      @user = user
      @request = request
    end

    def call
      pool = load_pool
      load_availability(pool)
      eligible, exclusions = apply_hard_constraints(pool)
      score!(eligible)
      ranked = eligible.sort_by { |c| [-c.score, c.item.priority ? 0 : 1, c.item.added_at, c.item.id] }
      picks = diversify(ranked).each_with_index.map do |candidate, index|
        Pick.new(candidate:, rank: index + 1, headline: headline(candidate), explanations: explain(candidate))
      end
      Result.new(eligible_count: eligible.size, pool_count: pool.size, exclusions:, picks:)
    end

    # Cheap count for the planner preview: constraints only, no scoring.
    def eligible_count
      pool = load_pool
      load_availability(pool)
      apply_hard_constraints(pool).first.size
    end

    private

    attr_reader :request

    def available = request.available_minutes
    def strict? = request.completion_preference != "open_to_longer"
    def continuing? = request.completion_preference == "continue_started"
    def availability_filter? = request.region.present? && request.availability.in?(%w[free free_or_subscribed])

    # Stored availability is always used for explanations; TMDB is only called when it's a filter.
    def load_availability(pool)
      @availability = if request.region.present?
        WatchAvailability.new(request.region).for_movies(pool.map(&:movie), fetch: availability_filter?)
      else
        {}
      end
    end

    def subscribed_ids = Array(request.subscribed_provider_ids)

    def watchable?(movie)
      avail = @availability[movie.id]
      return false unless avail
      return true if avail.free?

      request.availability == "free_or_subscribed" && (avail.provider_ids("subscription") & subscribed_ids).any?
    end

    def load_pool
      statuses = continuing? ? STARTED_STATUSES.dup : BASE_STATUSES.dup
      statuses << "abandoned" if request.include_abandoned
      items = @user.watchlist_items.where(status: statuses).includes(movie: :genres).to_a
      watched = minutes_watched_by_movie(items)

      items.map do |item|
        movie = item.movie
        started = STARTED_STATUSES.include?(item.status)
        minutes = movie.runtime_minutes
        # Started movies only need their remaining time, when a past attempt recorded progress.
        if started && minutes && (seen = watched[movie.id])
          minutes = [minutes - seen, 1].max
        end
        Candidate.new(item:, movie:, genre_ids: movie.genres.map(&:id), genre_names: movie.genres.map(&:name).sort,
                      minutes:, continuing: started && minutes != movie.runtime_minutes)
      end
    end

    # Progress from the most recent unfinished attempt per movie.
    def minutes_watched_by_movie(items)
      started_ids = items.select { |i| STARTED_STATUSES.include?(i.status) }.map(&:movie_id)
      return {} if started_ids.empty?

      @user.watch_sessions.where(movie_id: started_ids).where.not(outcome: "completed")
           .where.not(minutes_watched: nil).order(:started_at)
           .pluck(:movie_id, :minutes_watched).to_h
    end

    def apply_hard_constraints(pool)
      exclusions = { "too_long" => 0, "missing_runtime" => 0, "not_available" => 0 }
      eligible = pool.select do |candidate|
        if availability_filter? && !watchable?(candidate.movie)
          exclusions["not_available"] += 1
          next false
        end
        next true unless strict?

        if candidate.minutes.nil?
          exclusions["missing_runtime"] += 1
          false
        elsif candidate.minutes > available
          exclusions["too_long"] += 1
          false
        else
          true
        end
      end
      [eligible, exclusions]
    end

    def score!(candidates)
      selected_genres = Array(request.genre_ids)
      mood_genres = MOOD_GENRES[request.mood]
      active = { runtime: true }
      active[:genre] = selected_genres.any?
      active[:mood] = mood_genres.present?
      active[:priority] = candidates.any? { |c| c.item.priority }
      active[:personal_interest] = candidates.any? { |c| c.item.personal_rating }
      weights = WEIGHTS.select { |key, _| active[key] }
      total_weight = weights.values.sum

      candidates.each do |c|
        raw = {
          runtime: runtime_score(c.minutes),
          genre: (genre_score(c.genre_ids, selected_genres) if active[:genre]),
          mood: (mood_score(c.genre_names, mood_genres) if active[:mood]),
          priority: (c.item.priority ? 1.0 : 0.0 if active[:priority]),
          personal_interest: (c.item.personal_rating ? c.item.personal_rating / 10.0 : NEUTRAL_SCORE if active[:personal_interest])
        }.compact
        c.components = raw.to_h { |key, value| [key, { score: value.round(4), weight: (weights[key] / total_weight).round(4) }] }
        c.score = raw.sum { |key, value| value * weights[key] / total_weight }.round(4)
      end
    end

    def runtime_score(minutes)
      return NEUTRAL_SCORE if minutes.nil?

      ratio = minutes.to_f / available
      if ratio <= IDEAL_MIN_RATIO
        0.5 + 0.5 * (ratio / IDEAL_MIN_RATIO) # very short: leaves most of the window unused
      elsif ratio <= IDEAL_MAX_RATIO
        1.0
      elsif ratio <= 1.0
        1.0 - 0.2 * (ratio - IDEAL_MAX_RATIO) / (1.0 - IDEAL_MAX_RATIO) # fits, but with little buffer
      else
        [0.8 - 1.6 * (ratio - 1.0), 0.0].max # over the window; only reachable when open_to_longer
      end
    end

    # Any match counts most; covering more of the selected genres adds the rest.
    def genre_score(movie_genre_ids, selected)
      matched = (movie_genre_ids & selected).size
      matched.zero? ? 0.0 : 0.5 + 0.5 * matched / selected.size
    end

    def mood_score(movie_genre_names, mood_genres)
      (movie_genre_names & mood_genres).any? ? 1.0 : 0.0
    end

    def diversify(ranked)
      limit = (request.limit || DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
      remaining = ranked.dup
      picks = []
      while picks.size < limit && remaining.any?
        best = remaining.max_by.with_index do |c, index|
          overlap = picks.map { |p| jaccard(c.genre_ids, p.genre_ids) }.max || 0
          [c.score - DIVERSITY_PENALTY * overlap, -index] # -index keeps the original order on ties
        end
        picks << remaining.delete(best)
      end
      picks
    end

    def jaccard(a, b)
      union = (a | b).size
      union.zero? ? 0.0 : (a & b).size.to_f / union
    end

    def headline(c)
      return "Pick up where you left off" if c.continuing
      return "Runtime unknown — check before you start" if c.minutes.nil?
      return "A longer pick for tonight" if c.minutes > available
      return "Perfect for your #{available}-minute window" if c.components.dig(:runtime, :score).to_f >= 0.95

      "Fits your #{available}-minute window"
    end

    # Every line is backed by data on this request or the user's own watchlist entry.
    def explain(c)
      lines = []
      lines << runtime_explanation(c)
      matched = c.movie.genres.select { |g| Array(request.genre_ids).include?(g.id) }
      if matched.any?
        lines << { code: "genre_match", text: "Matches your pick: #{matched.map(&:name).sort.to_sentence}." }
      end
      # Skip the mood line when the only genres behind it were already named in the genre match.
      if (mood_genres = MOOD_GENRES[request.mood]) && (hit = (c.genre_names & mood_genres) - matched.map(&:name)).any?
        lines << { code: "mood_match", text: "#{hit.first} suits a #{MOOD_LABELS[request.mood]} mood." }
      end
      if (avail = @availability[c.movie.id])
        if (free = avail.providers_in("free").first)
          lines << { code: "free_to_watch", text: "Free to watch on #{free['name']}." }
        elsif (mine = avail.providers_in("subscription").find { |p| subscribed_ids.include?(p["id"]) })
          lines << { code: "on_your_service", text: "On #{mine['name']}, which you have." }
        end
      end
      lines << { code: "priority", text: "You marked this as a priority." } if c.item.priority
      lines << { code: "personal_rating", text: "You rated it #{c.item.personal_rating}/10." } if c.item.personal_rating
      lines << { code: "started", text: "You've already started this one." } if STARTED_STATUSES.include?(c.item.status)
      lines << { code: "reconsidered", text: "You stopped watching this one before." } if c.item.abandoned?
      lines
    end

    def runtime_explanation(c)
      minutes = c.minutes
      return { code: "runtime_unknown", text: "Runtime isn't available for this one." } if minutes.nil?
      return { code: "runtime_over", text: "Runs #{minutes - available} minutes past your #{available}-minute window." } if minutes > available
      return { code: "runtime_remaining", text: "About #{minutes} minutes left — fits your #{available}-minute window." } if c.continuing

      spare = available - minutes
      if spare <= 5
        { code: "runtime_tight", text: "Uses just about all of your #{available} minutes." }
      else
        { code: "runtime_fit", text: "Fits your #{available}-minute window with #{spare} minutes to spare." }
      end
    end
  end
end
