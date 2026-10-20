class WatchlistItem < ApplicationRecord
  STATUSES = %w[want_to_watch watching paused watched abandoned].freeze

  belongs_to :user
  belongs_to :movie
  has_many :watch_sessions, dependent: :nullify

  enum :status, STATUSES.index_by(&:itself), validate: true

  validates :movie_id, uniqueness: { scope: :user_id, message: "is already on your watchlist" }
  validates :personal_rating, numericality: { only_integer: true, in: 1..10 }, allow_nil: true

  before_validation { self.added_at ||= Time.current }
  before_save { self.last_interaction_at = Time.current }
end
