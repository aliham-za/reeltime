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

  describe "discover" do
    let(:comedy) { Genre.create!(name: "Comedy", external_id: 35) }

    before do
      create_movie(title: "Short Comedy", runtime: 80, genres: [comedy], release_date: Date.new(2021, 5, 1))
      create_movie(title: "Long Comedy", runtime: 140, genres: [comedy], release_date: Date.new(2021, 6, 1))
      create_movie(title: "Short Drama", runtime: 85, genres: ["Drama"], release_date: Date.new(2019, 1, 1))
    end

    it "filters the local catalog by genre, year and runtime when TMDB is not configured" do
      allow(Tmdb::Client).to receive(:configured?).and_return(false)

      get "/api/v1/movies/discover", params: { genre_id: comedy.id, year: 2021, max_runtime: 90 }
      expect(json["data"].map { |m| m["title"] }).to eq(["Short Comedy"])
      expect(json.dig("meta", "source")).to eq("local")
    end

    it "sends the filters to TMDB using TMDB's genre id" do
      allow(Tmdb::Client).to receive(:configured?).and_return(true)
      client = instance_double(Tmdb::Client)
      allow(Tmdb::Client).to receive(:new).and_return(client)
      allow(client).to receive(:discover).and_return("results" => [{ "id" => 7, "title" => "Remote", "genre_ids" => [35] }], "page" => 2, "total_pages" => 900)

      get "/api/v1/movies/discover", params: { genre_id: comedy.id, year: 2021, max_runtime: 90, page: 2 }

      expect(client).to have_received(:discover).with(page: 2, genre_id: 35, year: 2021, max_runtime: 90)
      expect(json["data"].first).to include("title" => "Remote", "tmdb_id" => 7)
      expect(json["meta"]).to include("source" => "tmdb", "total_pages" => 500)
    end

    it "falls back to filtered local movies when TMDB fails" do
      allow(Tmdb::Client).to receive(:configured?).and_return(true)
      allow_any_instance_of(Tmdb::Client).to receive(:discover).and_raise(Tmdb::Error, "TMDB is unreachable")

      get "/api/v1/movies/discover", params: { max_runtime: 90 }
      expect(json["data"].map { |m| m["title"] }).to contain_exactly("Paper Moons", "Short Comedy", "Short Drama")
      expect(json.dig("meta", "notice")).to be_present
    end

    it "validates filters" do
      get "/api/v1/movies/discover", params: { max_runtime: 5 }
      expect(response).to have_http_status(:unprocessable_content)
      get "/api/v1/movies/discover", params: { year: 1800 }
      expect(response).to have_http_status(:unprocessable_content)
      get "/api/v1/movies/discover", params: { genre_id: 0 }
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  it "rejects an empty search" do
    get "/api/v1/movies/search", params: { q: " " }
    expect(response).to have_http_status(:bad_request)
  end
end
