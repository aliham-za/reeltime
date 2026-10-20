class MovieAvailability < ApplicationRecord
  GROUPS = %w[free subscription rent buy].freeze

  belongs_to :movie

  validates :region, format: { with: /\A[A-Z]{2}\z/ }

  def providers_in(group) = Array(providers[group])
  def provider_ids(group) = providers_in(group).map { |p| p["id"] }
  def free? = providers_in("free").any?
end
