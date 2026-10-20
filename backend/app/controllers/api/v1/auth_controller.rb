module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :require_user, only: %i[register login]
      rate_limit to: 10, within: 3.minutes, only: %i[register login],
                 with: -> { render_error(:too_many_requests, "Too many attempts. Try again in a few minutes.") }

      def register
        user = User.new(params.require(:user).permit(:email, :password))
        if user.save
          sign_in(user)
          render status: :created, json: { data: ApiJson.user(user) }
        else
          render_invalid(user)
        end
      end

      def login
        user = User.find_by(email: params.dig(:user, :email).to_s.strip.downcase)
        if user&.authenticate(params.dig(:user, :password).to_s)
          sign_in(user)
          render json: { data: ApiJson.user(user) }
        else
          render_error(:unauthorized, "That email and password don't match", code: "invalid_credentials")
        end
      end

      def logout
        reset_session
        head :no_content
      end

      def me
        render json: { data: ApiJson.user(current_user) }
      end

      # Viewing preferences: country and subscribed services.
      def update_me
        if current_user.update(params.require(:user).permit(:country, subscribed_provider_ids: []))
          render json: { data: ApiJson.user(current_user) }
        else
          render_invalid(current_user)
        end
      end

      private

      def sign_in(user)
        reset_session # prevent session fixation
        session[:user_id] = user.id
      end
    end
  end
end
