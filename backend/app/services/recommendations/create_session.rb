module Recommendations
  # Validates a planner request, runs the engine and stores the session with the shortlist exactly
  # as generated (scores and explanations are snapshotted, not recomputed later).
  class CreateSession
    def self.call(user, params) = new(user, params).call

    def initialize(user, params)
      @user = user
      @params = params
    end

    def call
      session = @user.recommendation_sessions.new(
        available_minutes: @params[:available_minutes],
        mood: @params[:mood].presence,
        genre_ids: Genre.where(id: Array(@params[:genre_ids])).pluck(:id),
        viewing_context: @params[:viewing_context].presence,
        completion_preference: @params[:completion_preference].presence || "single_sitting",
        include_abandoned: ActiveModel::Type::Boolean.new.cast(@params[:include_abandoned]) || false,
        availability: @params[:availability].presence || "anywhere",
        region: @user.country,
        algorithm_version: Engine::VERSION
      )
      return [session, nil] unless session.valid?

      result = Engine.new(@user, Engine::Request.new(
        available_minutes: session.available_minutes, mood: session.mood, genre_ids: session.genre_ids,
        viewing_context: session.viewing_context, completion_preference: session.completion_preference,
        include_abandoned: session.include_abandoned, limit: @params[:limit]&.to_i,
        availability: session.availability, region: session.region, subscribed_provider_ids: @user.subscribed_provider_ids
      )).call

      RecommendationSession.transaction do
        session.candidate_count = result.eligible_count
        session.save!
        result.picks.each do |pick|
          session.recommendation_items.create!(
            movie: pick.candidate.movie, rank: pick.rank, total_score: pick.candidate.score,
            score_components: pick.candidate.components,
            explanation_data: { headline: pick.headline, reasons: pick.explanations }
          )
        end
      end
      [session, result]
    end
  end
end
