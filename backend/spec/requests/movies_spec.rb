require "rails_helper"

RSpec.describe "Movies", type: :request do
  let(:user) { create_user }

  before do
    sign_in(user)
    create_movie(title: "Paper Moons", runtime: 82)
  end

  it "searches the local catalog when TMDB is not configured" do
    allow(Tmdb::Client).to receive(:configured?).and_return(false)
    get "/api/v1/movies/search", params: { q: "paper" }
    expect(json["data"].map { |m| m["title"] }).to eq(["Paper Moons"])
    expect(json.dig("meta", "source")).to eq("local")
  end

  it "falls back to local movies when TMDB fails" do
    allow(Tmdb::Client).to receive(:configured?).and_return(true)
    allow_any_instance_of(Tmdb::Client).to receive(:search).and_raise(Tmdb::Error, "TMDB is unreachable")

    get "/api/v1/movies/search", params: { q: "paper" }
    expect(response).to have_http_status(:ok)
    expect(json.dig("meta", "source")).to eq("local")
    expect(json.dig("meta", "notice")).to be_present
  end

  it "reports a provider outage when importing a movie" do
    allow(Tmdb::Client).to receive(:configured?).and_return(true)
    allow_any_instance_of(Tmdb::Client).to receive(:movie).and_raise(Tmdb::Error, "TMDB is unreachable")

    post "/api/v1/watchlist", params: { tmdb_id: 603 }, as: :json
    expect(response).to have_http_status(:service_unavailable)
    expect(json.dig("error", "code")).to eq("provider_unavailable")
  end

  it "imports TMDB details with runtime and genres" do
    allow(Tmdb::Client).to receive(:configured?).and_return(true)
    allow_any_instance_of(Tmdb::Client).to receive(:movie).and_return(
      "id" => 42, "title" => "Imported", "runtime" => 101, "release_date" => "2001-05-04",
      "genres" => [{ "id" => 35, "name" => "Comedy" }], "poster_path" => "/p.jpg"
    )

    post "/api/v1/watchlist", params: { tmdb_id: 42 }, as: :json
    expect(response).to have_http_status(:created)
    expect(json.dig("data", "movie")).to include("tmdb_id" => 42, "runtime_minutes" => 101, "release_year" => 2001)
    expect(json.dig("data", "movie", "genres").map { |g| g["name"] }).to eq(["Comedy"])
  end

  it "rejects an empty search" do
    get "/api/v1/movies/search", params: { q: " " }
    expect(response).to have_http_status(:bad_request)
  end
end
