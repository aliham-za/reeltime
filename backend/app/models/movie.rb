class Movie < ApplicationRecord
  has_many :movie_genres, dependent: :delete_all
  has_many :genres, through: :movie_genres

  enum :source, { tmdb: "tmdb", local: "local" }, validate: true

  validates :title, presence: true, length: { maximum: 300 }
  validates :runtime_minutes, numericality: { only_integer: true, greater_than: 0, less_than: 1000 }, allow_nil: true
  validates :tmdb_id, uniqueness: true, allow_nil: true

  scope :search, ->(q) { where("movies.title ILIKE ?", "%#{sanitize_sql_like(q)}%") }

  def release_year = release_date&.year
end
