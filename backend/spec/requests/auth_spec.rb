require "rails_helper"

RSpec.describe "Auth", type: :request do
  it "registers, reads the current user, and logs out" do
    post "/api/v1/auth/register", params: { user: { email: "New@Example.test", password: "password123" } }, as: :json
    expect(response).to have_http_status(:created)
    expect(json.dig("data", "email")).to eq("new@example.test")

    get "/api/v1/me"
    expect(json.dig("data", "email")).to eq("new@example.test")

    delete "/api/v1/auth/logout"
    get "/api/v1/me"
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects short passwords and duplicate emails" do
    create_user(email: "taken@example.test")
    post "/api/v1/auth/register", params: { user: { email: "TAKEN@example.test", password: "short" } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("error", "details").keys).to include("email", "password")
  end

  it "rejects wrong credentials without saying which part was wrong" do
    user = create_user
    post "/api/v1/auth/login", params: { user: { email: user.email, password: "nope" } }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(json.dig("error", "code")).to eq("invalid_credentials")
  end

  it "protects user endpoints" do
    %w[/api/v1/watchlist /api/v1/watch_sessions /api/v1/insights/overview].each do |path|
      get path
      expect(response).to have_http_status(:unauthorized), path
    end
  end
end
