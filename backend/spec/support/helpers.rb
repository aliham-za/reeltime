# Small builders instead of a factory library.
module Helpers
  def create_user(email: "user#{SecureRandom.hex(4)}@example.test", password: "password123")
    User.create!(email:, password:)
  end

  def genre(name)
    Genre.find_or_create_by!(name:)
  end

  def create_movie(title: "Movie #{SecureRandom.hex(3)}", runtime: 90, genres: [], **attrs)
    Movie.create!(title:, runtime_minutes: runtime, source: "local", **attrs).tap do |m|
      m.genres = genres.map { |g| g.is_a?(Genre) ? g : genre(g) }
    end
  end

  def add_to_watchlist(user, movie, **attrs)
    user.watchlist_items.create!(movie:, **attrs)
  end

  def sign_in(user, password: "password123")
    post "/api/v1/auth/login", params: { user: { email: user.email, password: } }, as: :json
    expect(response).to have_http_status(:ok)
  end

  def json = JSON.parse(response.body)
end

RSpec.configure do |config|
  config.include Helpers
end

module AvailabilityHelpers
  # Stores fresh availability so specs never need TMDB.
  def set_availability(movie, region: "US", free: [], subscription: [], rent: [])
    to_providers = ->(list) { list.map { |id, name| { "id" => id, "name" => name, "logo_path" => "/#{id}.png" } } }
    MovieAvailability.create!(movie:, region:, link: "https://www.themoviedb.org/movie/#{movie.id}/watch",
                              fetched_at: Time.current,
                              providers: { "free" => to_providers.(free), "subscription" => to_providers.(subscription),
                                           "rent" => to_providers.(rent), "buy" => [] })
  end
end

RSpec.configure do |config|
  config.include AvailabilityHelpers
end
