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
