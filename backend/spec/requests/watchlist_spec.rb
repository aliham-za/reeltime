require "rails_helper"

RSpec.describe "Watchlist", type: :request do
  let(:user) { create_user }
  let(:movie) { create_movie(title: "Paper Moons", runtime: 82, genres: ["Comedy"]) }

  before { sign_in(user) }

  it "adds a movie and rejects duplicates" do
    post "/api/v1/watchlist", params: { movie_id: movie.id }, as: :json
    expect(response).to have_http_status(:created)
    expect(json.dig("data", "status")).to eq("want_to_watch")

    post "/api/v1/watchlist", params: { movie_id: movie.id }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(json.dig("error", "code")).to eq("duplicate")
  end

  it "filters, searches and sorts" do
    add_to_watchlist(user, movie)
    add_to_watchlist(user, create_movie(title: "Iron Tide", runtime: 142, genres: ["War"]), status: "paused")

    get "/api/v1/watchlist", params: { status: "paused" }
    expect(json["data"].map { |i| i.dig("movie", "title") }).to eq(["Iron Tide"])

    get "/api/v1/watchlist", params: { q: "paper" }
    expect(json["data"].size).to eq(1)

    get "/api/v1/watchlist", params: { sort: "runtime" }
    expect(json["data"].map { |i| i.dig("movie", "runtime_minutes") }).to eq([82, 142])
    expect(json["meta"]).to include("total" => 2)
  end

  it "updates status, priority and rating with validation" do
    item = add_to_watchlist(user, movie)
    patch "/api/v1/watchlist/#{item.id}", params: { watchlist_item: { status: "watched", priority: true, personal_rating: 8 } }, as: :json
    expect(json["data"]).to include("status" => "watched", "priority" => true, "personal_rating" => 8)

    patch "/api/v1/watchlist/#{item.id}", params: { watchlist_item: { status: "loved_it" } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)

    patch "/api/v1/watchlist/#{item.id}", params: { watchlist_item: { personal_rating: 11 } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "closes an open attempt when a movie is marked watched by hand" do
    item = add_to_watchlist(user, movie, status: "watching")
    ws = user.watch_sessions.create!(movie:, watchlist_item: item, started_at: 1.hour.ago)

    patch "/api/v1/watchlist/#{item.id}", params: { watchlist_item: { status: "watched" } }, as: :json
    expect(ws.reload).to have_attributes(outcome: "completed", ended_at: be_present)
  end

  it "does not expose or modify another user's items" do
    other_item = add_to_watchlist(create_user, movie)

    get "/api/v1/watchlist/#{other_item.id}"
    expect(response).to have_http_status(:not_found)
    patch "/api/v1/watchlist/#{other_item.id}", params: { watchlist_item: { status: "watched" } }, as: :json
    expect(response).to have_http_status(:not_found)
    delete "/api/v1/watchlist/#{other_item.id}"
    expect(response).to have_http_status(:not_found)
    expect(other_item.reload.status).to eq("want_to_watch")
  end

  it "summarizes counts and common windows" do
    add_to_watchlist(user, movie)
    add_to_watchlist(user, create_movie(runtime: 110))

    get "/api/v1/watchlist/summary"
    expect(json["data"]).to include("total" => 2, "fits_window" => { "45" => 0, "90" => 1, "120" => 2 })
  end
end
