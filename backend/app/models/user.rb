class User < ApplicationRecord
  has_secure_password

  has_many :watchlist_items, dependent: :delete_all
  has_many :recommendation_sessions, dependent: :delete_all
  has_many :watch_sessions, dependent: :delete_all

  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
  validates :password, length: { minimum: 8, maximum: 72 }, allow_nil: true
end
