class RecommendationItem < ApplicationRecord
  belongs_to :recommendation_session
  belongs_to :movie
end
