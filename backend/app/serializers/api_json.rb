# Plain JSON shapes for the API. One place, so every endpoint renders movies the same way.
module ApiJson
  module_function

  def movie(movie)
    {
      id: movie.id,
      tmdb_id: movie.tmdb_id,
      source: movie.source,
      title: movie.title,
      original_title: movie.original_title,
      overview: movie.overview,
      release_date: movie.release_date,
      release_year: movie.release_year,
      runtime_minutes: movie.runtime_minutes,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      original_language: movie.original_language,
      genres: movie.genres.map { |g| genre(g) }
    }
  end

  def genre(genre) = { id: genre.id, name: genre.name }

  def watchlist_item(item)
    {
      id: item.id,
      status: item.status,
      priority: item.priority,
      personal_rating: item.personal_rating,
      added_at: item.added_at,
      last_interaction_at: item.last_interaction_at,
      movie: movie(item.movie)
    }
  end

  def recommendation_session(session, result = nil)
    {
      id: session.id,
      created_at: session.created_at,
      algorithm_version: session.algorithm_version,
      constraints: {
        available_minutes: session.available_minutes,
        mood: session.mood,
        genre_ids: session.genre_ids,
        viewing_context: session.viewing_context,
        completion_preference: session.completion_preference,
        include_abandoned: session.include_abandoned,
        availability: session.availability,
        region: session.region
      },
      candidate_count: session.candidate_count,
      exclusions: result&.exclusions,
      selected_movie_id: session.selected_movie_id,
      items: session.recommendation_items.map { |item| recommendation_item(item) }
    }
  end

  def recommendation_item(item)
    {
      id: item.id,
      rank: item.rank,
      total_score: item.total_score.to_f,
      score_components: item.score_components,
      headline: item.explanation_data["headline"],
      reasons: item.explanation_data["reasons"],
      selected_at: item.selected_at,
      dismissed_at: item.dismissed_at,
      movie: movie(item.movie)
    }
  end

  def watch_session(ws)
    {
      id: ws.id,
      outcome: ws.outcome,
      started_at: ws.started_at,
      ended_at: ws.ended_at,
      minutes_watched: ws.minutes_watched,
      viewing_context: ws.viewing_context,
      personal_feedback: ws.personal_feedback,
      recommendation_session_id: ws.recommendation_session_id,
      watchlist_item_id: ws.watchlist_item_id,
      movie: movie(ws.movie)
    }
  end

  def user(user)
    { id: user.id, email: user.email, country: user.country, subscribed_provider_ids: user.subscribed_provider_ids, created_at: user.created_at }
  end

  def availability(avail, region, subscribed_ids)
    return { region:, link: nil, groups: MovieAvailability::GROUPS.index_with { [] } } unless avail

    groups = MovieAvailability::GROUPS.index_with do |group|
      avail.providers_in(group).map { |p| p.merge("subscribed" => subscribed_ids.include?(p["id"])) }
    end
    { region:, link: avail.link, fetched_at: avail.fetched_at, groups: }
  end
end
