class User < ApplicationRecord
  has_secure_password

  has_many :watchlist_items, dependent: :delete_all
  has_many :recommendation_sessions, dependent: :delete_all
  has_many :watch_sessions, dependent: :delete_all

  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
  validates :password, length: { minimum: 8, maximum: 72 }, allow_nil: true
  validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
  validates :subscribed_provider_ids, length: { maximum: 50, message: "can include at most 50 services" }

  normalizes :country, with: ->(code) { code.to_s.strip.upcase }
  normalizes :subscribed_provider_ids, with: ->(ids) { Array(ids).map(&:to_i).select(&:positive?).uniq }
end
