# "Where to watch" per movie and country, from TMDB's watch-provider data (sourced from JustWatch).
# Results are stored in movie_availabilities and refreshed once they're older than TTL, so planner
# filters and repeat page views don't hit TMDB every time.
class WatchAvailability
  TTL = 24.hours
  # TMDB monetization types folded into the groups ReelTime shows.
  GROUP_SOURCES = {
    "free" => %w[free ads],
    "subscription" => %w[flatrate],
    "rent" => %w[rent],
    "buy" => %w[buy]
  }.freeze
  # ponytail: synchronous fetches, capped per call; move to a background refresh if watchlists grow large.
  MAX_FETCHES = 40

  def initialize(region, client: Tmdb::Client.new)
    @region = region
    @client = client
  end

  def for_movie(movie) = for_movies([movie])[movie.id]

  # => { movie_id => MovieAvailability }. Movies with no TMDB id (or that TMDB can't answer for) are absent.
  # fetch: false only reads what's already stored, never calling TMDB.
  def for_movies(movies, fetch: true)
    movies = movies.select(&:tmdb_id)
    stored = MovieAvailability.where(movie_id: movies.map(&:id), region: @region).index_by(&:movie_id)
    return stored unless fetch && Tmdb::Client.configured?

    stale = movies.reject { |m| stored[m.id] && stored[m.id].fetched_at > TTL.ago }
    stale.first(MAX_FETCHES).each do |movie|
      stored[movie.id] = refresh(movie)
    rescue Tmdb::Error => e
      Rails.logger.warn("[WatchAvailability] #{movie.tmdb_id}/#{@region}: #{e.message}")
    end
    stored
  end

  private

  def refresh(movie)
    data = @client.watch_providers(movie.tmdb_id).dig("results", @region) || {}
    providers = GROUP_SOURCES.transform_values do |sources|
      sources.flat_map { |source| Array(data[source]) }
             .sort_by { |p| p["display_priority"].to_i }
             .uniq { |p| p["provider_id"] }
             .map { |p| { "id" => p["provider_id"], "name" => p["provider_name"], "logo_path" => p["logo_path"] } }
    end
    record = MovieAvailability.find_or_initialize_by(movie:, region: @region)
    record.update!(link: data["link"], providers:, fetched_at: Time.current)
    record
  rescue ActiveRecord::RecordNotUnique
    MovieAvailability.find_by!(movie:, region: @region)
  end
end
