module Api
  module V1
    class WatchSessionsController < ApplicationController
      def index
        scope = current_user.watch_sessions.includes(movie: :genres).order(started_at: :desc, id: :desc)
        scope = scope.where(outcome: params[:outcome].to_s.split(",")) if params[:outcome].present?
        scope = scope.where(movie_id: params[:movie_id]) if params[:movie_id].present?
        sessions, meta = paginate(scope)
        render json: { data: sessions.map { |ws| ApiJson.watch_session(ws) }, meta: }
      end

      def show
        render json: { data: ApiJson.watch_session(watch_session) }
      end

      # Starts (or resumes) an attempt. Passing an outcome other than in_progress logs a past viewing.
      def create
        movie = Movie.find(params.require(:movie_id))
        if (open = current_user.watch_sessions.open.find_by(movie:)) && params[:outcome].in?([nil, "", "in_progress"])
          return render json: { data: ApiJson.watch_session(open), meta: { resumed: true } }
        end

        rec_session = current_user.recommendation_sessions.find(params[:recommendation_session_id]) if params[:recommendation_session_id].present?
        ws = nil
        WatchSession.transaction do
          item = current_user.watchlist_items.find_or_create_by!(movie:)
          ws = current_user.watch_sessions.new(
            session_attributes.merge(movie:, watchlist_item: item, recommendation_session: rec_session)
          )
          ws.started_at ||= Time.current
          ws.ended_at ||= Time.current unless ws.in_progress?
          ws.save!
          sync_item_status(ws)
        end
        render status: :created, json: { data: ApiJson.watch_session(ws) }
      rescue ActiveRecord::RecordInvalid => e
        render_invalid(e.record)
      rescue ArgumentError => e
        render_error(:unprocessable_content, e.message, code: "validation_failed")
      end

      # Pause, finish, stop, or correct an earlier record.
      def update
        WatchSession.transaction do
          watch_session.assign_attributes(session_attributes)
          if watch_session.outcome_changed?
            watch_session.ended_at = watch_session.in_progress? ? nil : (watch_session.ended_at || Time.current)
          end
          watch_session.save!
          sync_item_status(watch_session)
        end
        render json: { data: ApiJson.watch_session(watch_session) }
      rescue ActiveRecord::RecordInvalid
        render_invalid(watch_session)
      rescue ArgumentError => e
        render_error(:unprocessable_content, e.message, code: "validation_failed")
      end

      private

      def watch_session
        @watch_session ||= current_user.watch_sessions.includes(movie: :genres).find(params[:id])
      end

      def session_attributes
        params.fetch(:watch_session, {}).permit(:outcome, :started_at, :ended_at, :minutes_watched, :viewing_context, :personal_feedback)
              .merge(params.permit(:outcome, :viewing_context).to_h.compact_blank) # top-level shorthand on create
      end

      # The movie's overall status follows its most recent attempt; older attempts stay as history.
      def sync_item_status(ws)
        item = ws.watchlist_item || current_user.watchlist_items.find_by(movie_id: ws.movie_id)
        return unless item

        latest = current_user.watch_sessions.where(movie_id: ws.movie_id).order(:started_at, :id).last
        item.update!(status: WatchSession::ITEM_STATUS_FOR_OUTCOME.fetch(latest.outcome)) if latest
      end
    end
  end
end
