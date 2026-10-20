class WatchSession < ApplicationRecord
  OUTCOMES = %w[in_progress completed paused abandoned interrupted].freeze
  # How an attempt's outcome moves the movie's overall watchlist status.
  ITEM_STATUS_FOR_OUTCOME = {
    "in_progress" => "watching",
    "completed" => "watched",
    "paused" => "paused",
    "interrupted" => "paused",
    "abandoned" => "abandoned"
  }.freeze

  belongs_to :user
  belongs_to :movie
  belongs_to :watchlist_item, optional: true
  belongs_to :recommendation_session, optional: true

  enum :outcome, OUTCOMES.index_by(&:itself), validate: true

  validates :viewing_context, inclusion: { in: RecommendationSession::VIEWING_CONTEXTS }, allow_nil: true
  validates :minutes_watched, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than: 1000 }, allow_nil: true
  validates :personal_feedback, length: { maximum: 2000 }
  validate :ended_after_started
  validate :one_open_attempt_per_movie, if: :in_progress?

  scope :open, -> { where(outcome: "in_progress") }
  scope :finished, -> { where(outcome: "completed") }

  private

  def ended_after_started
    errors.add(:ended_at, "must be after the start time") if ended_at && started_at && ended_at < started_at
  end

  def one_open_attempt_per_movie
    others = WatchSession.open.where(user_id:, movie_id:).where.not(id:)
    errors.add(:base, "You're already watching this movie") if others.exists?
  end
end
