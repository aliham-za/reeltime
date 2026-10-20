require "rails_helper"

RSpec.describe "Where to watch", type: :request do
  let(:user) { create_user }

  before { sign_in(user) }

  it "saves country and services, and validates them" do
    patch "/api/v1/me", params: { user: { country: "pk", subscribed_provider_ids: [8, "337", 8] } }, as: :json
    expect(json["data"]).to include("country" => "PK", "subscribed_provider_ids" => [8, 337])

    patch "/api/v1/me", params: { user: { country: "Pakistan" } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "does not let the profile update change the email or password" do
    patch "/api/v1/me", params: { user: { email: "hijack@example.test", password: "newpassword1" } }, as: :json
    expect(user.reload.email).not_to eq("hijack@example.test")
    expect(user.authenticate("password123")).to be_truthy
  end

  it "returns availability for the user's country, flagging their services" do
    user.update!(country: "US", subscribed_provider_ids: [8])
    movie = create_movie(tmdb_id: 5)
    set_availability(movie, free: [[73, "Tubi"]], subscription: [[8, "Netflix"]])

    get "/api/v1/movies/#{movie.id}/availability"
    data = json["data"]
    expect(data["region"]).to eq("US")
    expect(data.dig("groups", "free").map { |p| p["name"] }).to eq(["Tubi"])
    expect(data.dig("groups", "subscription").first).to include("name" => "Netflix", "subscribed" => true)
  end

  it "returns empty groups for movies that aren't on TMDB" do
    get "/api/v1/movies/#{create_movie(tmdb_id: nil).id}/availability"
    expect(json.dig("data", "groups").values).to all(be_empty)
  end

  it "filters the planner by availability" do
    free = create_movie(title: "Free", runtime: 60, tmdb_id: 1)
    paid = create_movie(title: "Paid", runtime: 60, tmdb_id: 2)
    [free, paid].each { |m| add_to_watchlist(user, m) }
    set_availability(free, free: [[73, "Tubi"]])
    set_availability(paid, rent: [[2, "Apple TV"]])

    get "/api/v1/recommendations/preview", params: { available_minutes: 90, availability: "free" }
    expect(json.dig("data", "eligible_count")).to eq(1)

    post "/api/v1/recommendations", params: { available_minutes: 90, availability: "free" }, as: :json
    expect(json.dig("data", "constraints")).to include("availability" => "free", "region" => "US")
    expect(json.dig("data", "items").map { |i| i.dig("movie", "title") }).to eq(["Free"])
    expect(json.dig("data", "exclusions", "not_available")).to eq(1)
  end

  it "rejects an unknown availability option" do
    post "/api/v1/recommendations", params: { available_minutes: 90, availability: "pirated" }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "asks TMDB for free movies in the user's country when discovering" do
    user.update!(country: "PK")
    allow(Tmdb::Client).to receive(:configured?).and_return(true)
    client = instance_double(Tmdb::Client)
    allow(Tmdb::Client).to receive(:new).and_return(client)
    allow(client).to receive(:discover).and_return("results" => [], "page" => 1, "total_pages" => 1)

    get "/api/v1/movies/discover", params: { free: true }
    expect(client).to have_received(:discover).with(page: 1, genre_id: nil, year: nil, max_runtime: nil, free_in: "PK")
  end
end
