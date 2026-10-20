module Api
  module V1
    class RecommendationsController < ApplicationController
      def create
        session, result = Recommendations::CreateSession.call(current_user, recommendation_params)
        return render_invalid(session) unless result

        render status: :created, json: { data: ApiJson.recommendation_session(reload_session(session.id), result) }
      end

      def show
        render json: { data: ApiJson.recommendation_session(reload_session(params[:id])) }
      end

      # How many watchlist movies satisfy the hard constraints, for the planner's live preview.
      def preview
        minutes = params[:available_minutes].to_i
        unless minutes.between?(RecommendationSession::MIN_MINUTES, RecommendationSession::MAX_MINUTES)
          return render_error(:unprocessable_content, "Available time must be between 10 and 360 minutes", code: "validation_failed")
        end

        request = Recommendations::Engine::Request.new(
          available_minutes: minutes,
          completion_preference: RecommendationSession::COMPLETION_PREFERENCES.include?(params[:completion_preference]) ? params[:completion_preference] : "single_sitting",
          include_abandoned: ActiveModel::Type::Boolean.new.cast(params[:include_abandoned])
        )
        render json: { data: { eligible_count: Recommendations::Engine.new(current_user, request).eligible_count } }
      end

      def choose
        session = current_user.recommendation_sessions.find(params[:id])
        item = session.recommendation_items.find_by!(movie_id: params.require(:movie_id))
        RecommendationSession.transaction do
          now = Time.current
          item.update!(selected_at: now, dismissed_at: nil)
          session.update!(selected_movie_id: item.movie_id, selected_at: now)
        end
        render json: { data: ApiJson.recommendation_session(reload_session(session.id)) }
      end

      # "Not tonight": recorded as a postponement for this session only, not as dislike.
      def dismiss
        session = current_user.recommendation_sessions.find(params[:id])
        session.recommendation_items.find_by!(movie_id: params.require(:movie_id)).update!(dismissed_at: Time.current)
        render json: { data: ApiJson.recommendation_session(reload_session(session.id)) }
      end

      private

      def recommendation_params
        params.permit(:available_minutes, :mood, :viewing_context, :completion_preference, :include_abandoned, :limit, genre_ids: [])
      end

      def reload_session(id)
        current_user.recommendation_sessions.includes(recommendation_items: { movie: :genres }).find(id)
      end
    end
  end
end
