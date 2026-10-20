module Api
  module V1
    class MoviesController < ApplicationController
      rate_limit to: 60, within: 1.minute, only: %i[search popular discover tmdb],
                 with: -> { render_error(:too_many_requests, "Slow down a little — too many searches.") }

      # Movies stored in ReelTime (imported or sample catalog).
      def index
        scope = Movie.includes(:genres).order(popularity: :desc, title: :asc)
        scope = scope.search(params[:q]) if params[:q].present?
        scope = scope.where(id: MovieGenre.where(genre_id: params[:genre_id]).select(:movie_id)) if params[:genre_id].present?
        movies, meta = paginate(scope)
        render json: { data: movies.map { |m| ApiJson.movie(m) }, meta: }
      end

      def show
        render_movie Movie.includes(:genres).find(params[:id])
      end

      # Where to watch this movie in the user's country.
      def availability
        movie = Movie.find(params[:id])
        avail = WatchAvailability.new(current_user.country).for_movie(movie)
        render json: { data: ApiJson.availability(avail, current_user.country, current_user.subscribed_provider_ids) }
      end

      def search
        query = params[:q].to_s.strip
        return render_error(:bad_request, "Enter a title to search", code: "invalid_query") if query.blank? || query.length > 100

        render_page catalog.search(query, page: page_params.first)
      end

      def popular
        render_page catalog.popular(page: page_params.first)
      end

      # Filtered browse: genre_id (ReelTime genre id), year, max_runtime (minutes), free. All optional.
      def discover
        genre = Genre.find_by(id: params[:genre_id]) if params[:genre_id].present?
        return render_error(:unprocessable_content, "Unknown genre", code: "validation_failed") if params[:genre_id].present? && genre.nil?

        year = params[:year].presence&.to_i
        return render_error(:unprocessable_content, "Year must be between 1900 and #{Date.current.year + 2}", code: "validation_failed") if year && !year.between?(1900, Date.current.year + 2)

        max_runtime = params[:max_runtime].presence&.to_i
        return render_error(:unprocessable_content, "Maximum runtime must be between 10 and 360 minutes", code: "validation_failed") if max_runtime && !max_runtime.between?(10, 360)

        free_in = current_user.country if ActiveModel::Type::Boolean.new.cast(params[:free])
        render_page catalog.discover(genre:, year:, max_runtime:, free_in:, page: page_params.first)
      end

      # Imports a TMDB movie (with runtime and genres) and returns the local record.
      def tmdb
        render_movie catalog.import(Integer(params[:tmdb_id]))
      rescue ArgumentError
        render_error(:bad_request, "Invalid TMDB id")
      end

      private

      def catalog = MovieCatalog.new

      # Single-movie views include the current user's watchlist entry, if any.
      def render_movie(movie)
        item = current_user.watchlist_items.find_by(movie:)
        entry = item&.slice(:id, :status, :priority, :personal_rating)
        render json: { data: ApiJson.movie(movie).merge(watchlist_item: entry) }
      end

      def render_page(page)
        in_watchlist = current_user.watchlist_items.where(movie_id: page.results.filter_map(&:id)).pluck(:movie_id, :id).to_h
        render json: {
          data: page.results.map { |m| ApiJson.movie(m).merge(watchlist_item_id: in_watchlist[m.id]) },
          meta: { page: page.page, total_pages: page.total_pages, source: page.source, notice: page.notice }.compact
        }
      end
    end
  end
end
