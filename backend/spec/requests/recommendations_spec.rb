require "rails_helper"

RSpec.describe "Recommendations", type: :request do
  let(:user) { create_user }

  before do
    sign_in(user)
    [45, 60, 75, 76, 110].each { |runtime| add_to_watchlist(user, create_movie(title: "R#{runtime}", runtime:)) }
  end

  it "creates a session that only contains movies satisfying the strict time limit" do
    post "/api/v1/recommendations", params: { available_minutes: 75, completion_preference: "single_sitting", limit: 5 }, as: :json

    expect(response).to have_http_status(:created)
    data = json["data"]
    expect(data["items"].map { |i| i.dig("movie", "title") }).to contain_exactly("R45", "R60", "R75")
    expect(data["candidate_count"]).to eq(3)
    expect(data["exclusions"]).to eq("too_long" => 2, "missing_runtime" => 0)
    expect(data["items"].first).to include("rank" => 1, "headline" => be_present, "reasons" => be_present, "score_components" => be_present)
  end

  it "snapshots the shortlist so it can be read back later" do
    post "/api/v1/recommendations", params: { available_minutes: 90 }, as: :json
    id = json.dig("data", "id")
    created_items = json.dig("data", "items")

    get "/api/v1/recommendations/#{id}"
    expect(json.dig("data", "items")).to eq(created_items)
    expect(RecommendationSession.find(id).algorithm_version).to eq("rules-v1")
  end

  it "validates input" do
    post "/api/v1/recommendations", params: { available_minutes: 5, mood: "hangry", completion_preference: "whatever" }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("error", "details").keys).to include("available_minutes", "mood", "completion_preference")
  end

  it "previews the eligible count" do
    get "/api/v1/recommendations/preview", params: { available_minutes: 60 }
    expect(json.dig("data", "eligible_count")).to eq(2)
  end

  it "records a selection and a postponement" do
    post "/api/v1/recommendations", params: { available_minutes: 75 }, as: :json
    id = json.dig("data", "id")
    first, second = json.dig("data", "items")

    post "/api/v1/recommendations/#{id}/dismiss", params: { movie_id: second.dig("movie", "id") }, as: :json
    post "/api/v1/recommendations/#{id}/select", params: { movie_id: first.dig("movie", "id") }, as: :json

    session = RecommendationSession.find(id)
    expect(session.selected_movie_id).to eq(first.dig("movie", "id"))
    expect(session.recommendation_items.find_by(movie_id: first.dig("movie", "id")).selected_at).to be_present
    expect(session.recommendation_items.find_by(movie_id: second.dig("movie", "id")).dismissed_at).to be_present
  end

  it "does not let users read or select from someone else's session" do
    other = create_user
    session, = Recommendations::CreateSession.call(other, { available_minutes: 75 })

    get "/api/v1/recommendations/#{session.id}"
    expect(response).to have_http_status(:not_found)
    post "/api/v1/recommendations/#{session.id}/select", params: { movie_id: 1 }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
