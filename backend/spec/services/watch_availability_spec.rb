require "rails_helper"

RSpec.describe WatchAvailability do
  let(:client) { instance_double(Tmdb::Client) }
  let(:movie) { create_movie(tmdb_id: 99) }
  let(:payload) do
    {
      "results" => {
        "US" => {
          "link" => "https://www.themoviedb.org/movie/99/watch?locale=US",
          "flatrate" => [{ "provider_id" => 8, "provider_name" => "Netflix", "logo_path" => "/n.png", "display_priority" => 2 }],
          "ads" => [{ "provider_id" => 73, "provider_name" => "Tubi", "logo_path" => "/t.png", "display_priority" => 5 }],
          "free" => [{ "provider_id" => 300, "provider_name" => "Pluto TV", "logo_path" => "/p.png", "display_priority" => 1 }],
          "rent" => [{ "provider_id" => 2, "provider_name" => "Apple TV", "logo_path" => "/a.png", "display_priority" => 3 }]
        }
      }
    }
  end

  before do
    allow(Tmdb::Client).to receive(:configured?).and_return(true)
    allow(client).to receive(:watch_providers).with(99).and_return(payload)
  end

  it "folds free and ad-supported into one free group, ordered by TMDB priority" do
    avail = described_class.new("US", client:).for_movie(movie)

    expect(avail.providers_in("free").map { |p| p["name"] }).to eq(["Pluto TV", "Tubi"])
    expect(avail.provider_ids("subscription")).to eq([8])
    expect(avail.providers_in("buy")).to eq([])
    expect(avail.link).to include("locale=US")
  end

  it "stores results and reuses them until they're stale" do
    service = described_class.new("US", client:)
    service.for_movie(movie)
    service.for_movie(movie)
    expect(client).to have_received(:watch_providers).once

    MovieAvailability.update_all(fetched_at: 2.days.ago)
    service.for_movie(movie)
    expect(client).to have_received(:watch_providers).twice
  end

  it "records 'not available' for countries without data" do
    avail = described_class.new("PK", client:).for_movie(movie)
    expect(avail.providers.values).to all(be_empty)
  end

  it "skips movies that aren't on TMDB and survives provider errors" do
    local = create_movie(tmdb_id: nil)
    allow(client).to receive(:watch_providers).and_raise(Tmdb::Error, "down")

    expect(described_class.new("US", client:).for_movies([local, movie])).to eq({})
  end

  it "only reads stored data when fetch is off" do
    expect(described_class.new("US", client:).for_movies([movie], fetch: false)).to eq({})
    expect(client).not_to have_received(:watch_providers)
  end
end
