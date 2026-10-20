class Genre < ApplicationRecord
  has_many :movie_genres, dependent: :delete_all
  has_many :movies, through: :movie_genres

  validates :name, presence: true, uniqueness: true
end
