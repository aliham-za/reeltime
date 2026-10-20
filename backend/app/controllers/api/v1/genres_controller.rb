module Api
  module V1
    class GenresController < ApplicationController
      def index
        render json: { data: Genre.order(:name).map { |g| ApiJson.genre(g) } }
      end
    end
  end
end
