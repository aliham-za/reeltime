require "rails_helper"

RSpec.describe "Watch sessions", type: :request do
  let(:user) { create_user }
  let(:movie) { create_movie(runtime: 95, genres: ["Drama"]) }
  let!(:item) { add_to_watchlist(user, movie) }

  before { sign_in(user) }

  def start!(**params)
    post "/api/v1/watch_sessions", params: { movie_id: movie.id, **params }, as: :json
    json["data"]
  end

  it "runs the full lifecycle and keeps earlier attempts as history" do
    first = start!
    expect(response).to have_http_status(:created)
    expect(item.reload.status).to eq("watching")

    expect(start!["id"]).to eq(first["id"]) # starting again resumes the open attempt
    expect(json.dig("meta", "resumed")).to be(true)

    patch "/api/v1/watch_sessions/#{first['id']}", params: { watch_session: { outcome: "abandoned", minutes_watched: 20 } }, as: :json
    expect(json["data"]).to include("outcome" => "abandoned", "ended_at" => be_present)
    expect(item.reload.status).to eq("abandoned")

    second = start!
    patch "/api/v1/watch_sessions/#{second['id']}", params: { watch_session: { outcome: "completed" } }, as: :json
    expect(item.reload.status).to eq("watched")

    get "/api/v1/watch_sessions"
    expect(json["data"].map { |s| s["outcome"] }).to contain_exactly("completed", "abandoned")
  end

  it "pausing does not count as abandoning" do
    ws = start!
    patch "/api/v1/watch_sessions/#{ws['id']}", params: { watch_session: { outcome: "paused", minutes_watched: 40 } }, as: :json
    expect(item.reload.status).to eq("paused")
  end

  it "lets the user correct an earlier record" do
    ws = start!
    patch "/api/v1/watch_sessions/#{ws['id']}", params: { watch_session: { outcome: "abandoned" } }, as: :json
    patch "/api/v1/watch_sessions/#{ws['id']}", params: { watch_session: { outcome: "completed" } }, as: :json
    expect(item.reload.status).to eq("watched")
  end

  it "logs a past viewing directly" do
    start!(outcome: "completed")
    expect(response).to have_http_status(:created)
    expect(item.reload.status).to eq("watched")
  end

  it "links a session to its recommendation" do
    rec, = Recommendations::CreateSession.call(user, { available_minutes: 120 })
    expect(start!(recommendation_session_id: rec.id)["recommendation_session_id"]).to eq(rec.id)
  end

  it "rejects invalid outcomes and other users' sessions" do
    ws = start!
    patch "/api/v1/watch_sessions/#{ws['id']}", params: { watch_session: { outcome: "meh" } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)

    other = create_user
    theirs = other.watch_sessions.create!(movie:, started_at: Time.current)
    patch "/api/v1/watch_sessions/#{theirs.id}", params: { watch_session: { outcome: "completed" } }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
