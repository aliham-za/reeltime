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
