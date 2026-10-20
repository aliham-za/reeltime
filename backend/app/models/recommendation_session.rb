class RecommendationSession < ApplicationRecord
  MOODS = %w[lighthearted exciting thought_provoking emotional suspenseful comfort anything].freeze
  VIEWING_CONTEXTS = %w[alone date_night friends family].freeze
  COMPLETION_PREFERENCES = %w[single_sitting open_to_longer continue_started].freeze
  MIN_MINUTES = 10
  MAX_MINUTES = 360

  belongs_to :user
  belongs_to :selected_movie, class_name: "Movie", optional: true
  has_many :recommendation_items, -> { order(:rank) }, dependent: :delete_all

  validates :available_minutes, numericality: { only_integer: true, in: MIN_MINUTES..MAX_MINUTES }
  validates :mood, inclusion: { in: MOODS }, allow_nil: true
  validates :viewing_context, inclusion: { in: VIEWING_CONTEXTS }, allow_nil: true
  validates :completion_preference, inclusion: { in: COMPLETION_PREFERENCES }
  validates :algorithm_version, presence: true
end
