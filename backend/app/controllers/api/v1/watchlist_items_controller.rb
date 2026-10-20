module Api
  module V1
    class WatchlistItemsController < ApplicationController
      SORTS = {
        "recent" => { added_at: :desc },
        "title" => "movies.title ASC",
        "runtime" => "movies.runtime_minutes ASC NULLS LAST",
        "priority" => { priority: :desc, added_at: :desc }
      }.freeze
      COMMON_WINDOWS = [45, 90, 120].freeze

      def index
        scope = current_user.watchlist_items.joins(:movie).includes(movie: :genres)
        scope = scope.where(status: params[:status].to_s.split(",")) if params[:status].present?
        scope = scope.where(movie_id: MovieGenre.where(genre_id: params[:genre_id]).select(:movie_id)) if params[:genre_id].present?
        scope = scope.merge(Movie.search(params[:q])) if params[:q].present?
        scope = scope.order(SORTS.fetch(params[:sort], SORTS["recent"])).order(:id)
        items, meta = paginate(scope)
        render json: { data: items.map { |i| ApiJson.watchlist_item(i) }, meta: }
      end

      def show
        render json: { data: ApiJson.watchlist_item(item) }
      end

      def create
        movie = if params[:tmdb_id].present?
          MovieCatalog.new.import(Integer(params[:tmdb_id]))
        else
          Movie.find(params.require(:movie_id))
        end
        if (existing = current_user.watchlist_items.find_by(movie:))
          return render_error(:conflict, "Already on your watchlist", code: "duplicate", details: { watchlist_item_id: existing.id })
        end

        new_item = current_user.watchlist_items.new(movie:, priority: ActiveModel::Type::Boolean.new.cast(params[:priority]) || false)
        if new_item.save
          render status: :created, json: { data: ApiJson.watchlist_item(new_item) }
        else
          render_invalid(new_item)
        end
      rescue ActiveRecord::RecordNotUnique
        render_error(:conflict, "Already on your watchlist", code: "duplicate")
      rescue ArgumentError
        render_error(:bad_request, "Invalid TMDB id")
      end

      def update
        WatchlistItem.transaction do
          item.assign_attributes(params.require(:watchlist_item).permit(:status, :priority, :personal_rating))
          # Marking a movie watched/abandoned by hand closes any attempt that was left open.
          if item.status_changed? && (outcome = { "watched" => "completed", "abandoned" => "abandoned" }[item.status])
            current_user.watch_sessions.open.where(movie_id: item.movie_id).find_each do |ws|
              ws.update!(outcome:, ended_at: Time.current)
            end
          end
          item.save!
        end
        render json: { data: ApiJson.watchlist_item(item) }
      rescue ActiveRecord::RecordInvalid
        render_invalid(item)
      rescue ArgumentError => e
        render_error(:unprocessable_content, e.message, code: "validation_failed")
      end

      def destroy
        item.destroy!
        head :no_content
      end

      # Dashboard numbers: counts by status and how many movies fit common windows in one sitting.
      def summary
        counts = current_user.watchlist_items.group(:status).count
        windows = COMMON_WINDOWS.to_h do |minutes|
          request = Recommendations::Engine::Request.new(available_minutes: minutes, completion_preference: "single_sitting")
          [minutes, Recommendations::Engine.new(current_user, request).eligible_count]
        end
        render json: { data: { total: counts.values.sum, by_status: WatchlistItem::STATUSES.to_h { |s| [s, counts[s] || 0] }, fits_window: windows } }
      end

      private

      def item
        @item ||= current_user.watchlist_items.includes(movie: :genres).find(params[:id])
      end
    end
  end
end
