# Movie metadata access. Uses TMDB when configured; otherwise (or when TMDB fails) falls back to
# movies already stored locally, so discovery and recommendations keep working offline.
#
# Remote results are returned as unsaved Movie-shaped hashes; a movie is only imported (persisted
# with genres) when someone opens its details or adds it to a watchlist.
class MovieCatalog
  Page = Struct.new(:results, :page, :total_pages, :source, :notice, keyword_init: true)
  PER_PAGE = 20

  def initialize(client: Tmdb::Client.new)
    @client = client
  end

  def search(query, page: 1)
    remote(page) { @client.search(query, page:) } || local_page(Movie.search(query), page)
  end

  def popular(page: 1)
    remote(page) { @client.popular(page:) } || local_page(Movie.all, page)
  end

  # Browse by genre (a local Genre), release year, maximum runtime in minutes, and free_in (a country
  # code: only movies free there); any may be nil.
  def discover(genre: nil, year: nil, max_runtime: nil, free_in: nil, page: 1)
    remote_page = if genre.nil? || genre.external_id
      filters = { genre_id: genre&.external_id, year:, max_runtime:, free_in: }
      remote(page) { max_runtime ? merged_discover(page, filters) : @client.discover(page:, **filters) }
    end
    remote_page = enforce_runtime(remote_page, max_runtime) if remote_page && max_runtime
    remote_page || local_page(local_discover_scope(genre, year, max_runtime, free_in), page)
  end

  # Finds or imports a TMDB movie with full details (runtime, genres).
  def import(tmdb_id)
    existing = Movie.find_by(tmdb_id:)
    return existing if existing&.runtime_minutes

    data = @client.movie(tmdb_id)
    Movie.transaction do
      movie = existing || Movie.new(tmdb_id: data["id"], source: "tmdb")
      movie.update!(normalize(data).merge(runtime_minutes: data["runtime"].to_i.positive? ? data["runtime"] : nil))
      movie.genres = Array(data["genres"]).map do |g|
        Genre.find_or_create_by!(external_id: g["id"]) { |genre| genre.name = g["name"] }
      end
      movie
    end
  rescue ActiveRecord::RecordNotUnique
    Movie.find_by!(tmdb_id:) # concurrent import won the race
  end

  private

  def remote(page)
    return nil unless Tmdb::Client.configured?

    data = yield
    known = Movie.where(tmdb_id: data["results"].map { |r| r["id"] }).includes(:genres).index_by(&:tmdb_id)
    genres = Genre.where.not(external_id: nil).index_by(&:external_id)
    results = data["results"].map do |r|
      known[r["id"]] || Movie.new(normalize(r).merge(tmdb_id: r["id"], source: "tmdb")).tap do |m|
        m.genres = Array(r["genre_ids"]).filter_map { |id| genres[id] }
      end
    end
    Page.new(results:, page: data["page"], total_pages: [data["total_pages"].to_i, 500].min, source: "tmdb")
  rescue Tmdb::Error => e
    Rails.logger.warn("[MovieCatalog] #{e.message}; using local catalog")
    @notice = "Movie search is temporarily unavailable, so you're seeing movies saved in ReelTime."
    nil
  end

  # With a runtime cap most of each TMDB page gets dropped (see enforce_runtime), so one app page
  # draws on RUNTIME_PAGE_SPAN TMDB pages to still show a useful number of movies.
  RUNTIME_PAGE_SPAN = 3

  def merged_discover(page, filters)
    first = (page.to_i.clamp(1, 500) - 1) * RUNTIME_PAGE_SPAN + 1
    pages = (first...first + RUNTIME_PAGE_SPAN).select { |n| n <= 500 }.map { |n| @client.discover(page: n, **filters) }
    total = [pages.first["total_pages"].to_i, 500].min
    { "results" => pages.flat_map { |d| d["results"] }.uniq { |r| r["id"] }, "page" => page.to_i,
      "total_pages" => (total / RUNTIME_PAGE_SPAN.to_f).ceil }
  end

  # TMDB's with_runtime filter doesn't match the runtime on its own movie details (it returns 95-137
  # minute movies for "under 90"), so check each result's real runtime and drop what's over the cap.
  # Details are cached by the client; unknown runtimes are dropped since they can't be promised.
  # ponytail: one details call per uncached result (8 at a time); pages can come back shorter than 20.
  def enforce_runtime(page, max_runtime)
    unknown = page.results.reject(&:runtime_minutes)
    runtimes = unknown.each_slice(8).flat_map do |batch|
      batch.map { |movie| Thread.new { [movie, (@client.movie(movie.tmdb_id)["runtime"] rescue nil)] } }.map(&:value)
    end
    runtimes.each { |movie, runtime| movie.runtime_minutes = runtime.to_i.positive? ? runtime : nil }
    page.results = page.results.select { |m| m.runtime_minutes && m.runtime_minutes <= max_runtime }
    page
  end

  def local_discover_scope(genre, year, max_runtime, free_in)
    scope = Movie.all
    if free_in
      free = MovieAvailability.where(region: free_in).where("jsonb_array_length(providers -> 'free') > 0")
      scope = scope.where(id: free.select(:movie_id))
    end
    scope = scope.where(id: MovieGenre.where(genre:).select(:movie_id)) if genre
    scope = scope.where(release_date: Date.new(year)..Date.new(year).end_of_year) if year
    scope = scope.where(runtime_minutes: 1..max_runtime) if max_runtime
    scope
  end

  def local_page(scope, page)
    page = [page.to_i, 1].max
    total = scope.count
    results = scope.includes(:genres).order(popularity: :desc, title: :asc).offset((page - 1) * PER_PAGE).limit(PER_PAGE)
    Page.new(results: results.to_a, page:, total_pages: [(total / PER_PAGE.to_f).ceil, 1].max, source: "local", notice: @notice)
  end

  def normalize(data)
    {
      title: data["title"].presence || data["original_title"] || "Untitled",
      original_title: data["original_title"],
      overview: data["overview"],
      release_date: (Date.parse(data["release_date"]) rescue nil),
      poster_path: data["poster_path"],
      backdrop_path: data["backdrop_path"],
      original_language: data["original_language"],
      popularity: data["popularity"].to_f
    }
  end
end
