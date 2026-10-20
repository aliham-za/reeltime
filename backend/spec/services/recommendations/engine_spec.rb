require "rails_helper"

RSpec.describe Recommendations::Engine do
  let(:user) { create_user }

  def run(available_minutes: 75, completion_preference: "single_sitting", **opts)
    request = described_class::Request.new(available_minutes:, completion_preference:, **opts)
    described_class.new(user, request).call
  end

  def titles(result) = result.picks.map { |p| p.candidate.movie.title }

  describe "hard constraints" do
    before do
      [45, 60, 75, 76, 110].each { |runtime| add_to_watchlist(user, create_movie(title: "R#{runtime}", runtime:)) }
    end

    it "never returns movies longer than a strict 75-minute window" do
      result = run(available_minutes: 75, limit: 5)

      expect(titles(result)).to contain_exactly("R45", "R60", "R75")
      expect(result.eligible_count).to eq(3)
      expect(result.exclusions).to eq("too_long" => 2, "missing_runtime" => 0, "not_available" => 0)
    end

    it "does not let a strong preference score override the time limit" do
      long = Movie.find_by!(title: "R110")
      long.genres = [genre("Comedy")]
      user.watchlist_items.find_by!(movie: long).update!(priority: true, personal_rating: 10)

      result = run(available_minutes: 75, genre_ids: [genre("Comedy").id], limit: 5)
      expect(titles(result)).not_to include("R110")
    end

    it "allows longer movies, ranked lower, when the user is open to longer" do
      result = run(available_minutes: 75, completion_preference: "open_to_longer", limit: 5)

      expect(titles(result)).to include("R76", "R110")
      expect(titles(result).last).to eq("R110")
    end

    it "excludes movies with unknown runtime when the window is strict" do
      add_to_watchlist(user, create_movie(title: "Unknown", runtime: nil))

      result = run(limit: 5)
      expect(titles(result)).not_to include("Unknown")
      expect(result.exclusions["missing_runtime"]).to eq(1)
    end
  end

  describe "pool" do
    it "returns nothing for an empty watchlist" do
      result = run
      expect(result.picks).to be_empty
      expect(result.eligible_count).to eq(0)
    end

    it "excludes watched and abandoned movies by default" do
      add_to_watchlist(user, create_movie(title: "Seen", runtime: 60), status: "watched")
      add_to_watchlist(user, create_movie(title: "Dropped", runtime: 60), status: "abandoned")
      add_to_watchlist(user, create_movie(title: "Fresh", runtime: 60))

      expect(titles(run)).to eq(["Fresh"])
    end

    it "includes abandoned movies only when asked to reconsider them" do
      add_to_watchlist(user, create_movie(title: "Dropped", runtime: 60), status: "abandoned")

      pick = run(include_abandoned: true).picks.first
      expect(pick.candidate.movie.title).to eq("Dropped")
      expect(pick.explanations.map { |e| e[:code] }).to include("reconsidered")
    end

    it "never recommends another user's watchlist" do
      add_to_watchlist(create_user, create_movie(title: "Theirs", runtime: 60))
      expect(run.picks).to be_empty
    end

    it "uses remaining runtime when continuing a started movie" do
      movie = create_movie(title: "Long epic", runtime: 150)
      item = add_to_watchlist(user, movie, status: "paused")
      user.watch_sessions.create!(movie:, watchlist_item: item, started_at: 2.days.ago, ended_at: 2.days.ago + 1.hour,
                                  minutes_watched: 100, outcome: "paused")
      add_to_watchlist(user, create_movie(title: "Not started", runtime: 40))

      result = run(available_minutes: 60, completion_preference: "continue_started")
      expect(titles(result)).to eq(["Long epic"])
      expect(result.picks.first.headline).to eq("Pick up where you left off")
      expect(result.picks.first.explanations.first[:text]).to include("About 50 minutes left")
    end
  end

  describe "scoring" do
    it "prefers a movie that fits with some buffer over one that uses every minute" do
      add_to_watchlist(user, create_movie(title: "Tight", runtime: 90))
      add_to_watchlist(user, create_movie(title: "Comfortable", runtime: 70))

      expect(titles(run(available_minutes: 90)).first).to eq("Comfortable")
    end

    it "ranks genre matches first" do
      add_to_watchlist(user, create_movie(title: "Drama", runtime: 70, genres: ["Drama"]))
      add_to_watchlist(user, create_movie(title: "Comedy", runtime: 70, genres: ["Comedy"]))

      result = run(genre_ids: [genre("Comedy").id])
      expect(titles(result).first).to eq("Comedy")
      expect(result.picks.first.explanations.map { |e| e[:text] }).to include("Matches your pick: Comedy.")
    end

    it "redistributes weight from preferences that were not supplied" do
      add_to_watchlist(user, create_movie(runtime: 60))

      components = run.picks.first.candidate.components
      expect(components.keys).to eq([:runtime])
      expect(components[:runtime][:weight]).to eq(1.0)
    end

    it "keeps scores normalized between 0 and 1" do
      add_to_watchlist(user, create_movie(runtime: 60, genres: ["Comedy"]), priority: true, personal_rating: 9)
      add_to_watchlist(user, create_movie(runtime: 20, genres: ["Drama"]))

      result = run(genre_ids: [genre("Comedy").id], mood: "lighthearted", limit: 5)
      result.picks.each do |pick|
        expect(pick.candidate.score).to be_between(0, 1)
        expect(pick.candidate.components.values.sum { |c| c[:weight] }).to be_within(0.001).of(1.0)
      end
    end

    it "boosts priority movies and says so" do
      add_to_watchlist(user, create_movie(title: "Normal", runtime: 60))
      add_to_watchlist(user, create_movie(title: "Priority", runtime: 60), priority: true)

      pick = run.picks.first
      expect(pick.candidate.movie.title).to eq("Priority")
      expect(pick.explanations.map { |e| e[:code] }).to include("priority")
    end

    it "is stable for equal scores" do
      3.times { |i| add_to_watchlist(user, create_movie(title: "Same #{i}", runtime: 60), added_at: (10 - i).days.ago) }
      expect(titles(run)).to eq(titles(run))
      expect(titles(run).first).to eq("Same 0") # oldest addition wins ties
    end
  end

  describe "explanations" do
    it "only explains with evidence present on the request or watchlist" do
      add_to_watchlist(user, create_movie(runtime: 60, genres: ["Drama"]))

      codes = run(mood: "lighthearted").picks.first.explanations.map { |e| e[:code] }
      expect(codes).to eq(["runtime_fit"]) # no mood match, no priority, no rating
    end

    it "does not repeat a genre match as a mood match" do
      add_to_watchlist(user, create_movie(runtime: 60, genres: %w[Comedy Family]))

      texts = run(mood: "lighthearted", genre_ids: [genre("Comedy").id]).picks.first.explanations.map { |e| e[:text] }
      expect(texts).to include("Matches your pick: Comedy.", "Family suits a lighthearted mood.")
    end

    it "mentions the spare time" do
      add_to_watchlist(user, create_movie(runtime: 60))
      expect(run(available_minutes: 75).picks.first.explanations.first[:text]).to eq("Fits your 75-minute window with 15 minutes to spare.")
    end
  end

  describe "diversity" do
    it "mixes genres when enough eligible movies exist" do
      add_to_watchlist(user, create_movie(title: "Comedy A", runtime: 60, genres: ["Comedy"]))
      add_to_watchlist(user, create_movie(title: "Comedy B", runtime: 60, genres: ["Comedy"]))
      add_to_watchlist(user, create_movie(title: "Comedy C", runtime: 60, genres: ["Comedy"]))
      add_to_watchlist(user, create_movie(title: "Thriller", runtime: 58, genres: ["Thriller"]))

      expect(titles(run(available_minutes: 75))).to include("Thriller")
    end

    it "returns a single movie confidently when only one fits" do
      add_to_watchlist(user, create_movie(title: "Only", runtime: 60))
      expect(titles(run)).to eq(["Only"])
    end
  end

  describe "where to watch" do
    let(:free_movie) { create_movie(title: "Free one", runtime: 60, tmdb_id: 1) }
    let(:netflix_movie) { create_movie(title: "On Netflix", runtime: 60, tmdb_id: 2) }
    let(:rental) { create_movie(title: "Rent only", runtime: 60, tmdb_id: 3) }

    before do
      [free_movie, netflix_movie, rental].each { |m| add_to_watchlist(user, m) }
      set_availability(free_movie, free: [[73, "Tubi"]])
      set_availability(netflix_movie, subscription: [[8, "Netflix"]])
      set_availability(rental, rent: [[2, "Apple TV"]])
      add_to_watchlist(user, create_movie(title: "Sample, not on TMDB", runtime: 60))
    end

    it "keeps only free movies when asked for free" do
      result = run(availability: "free", region: "US", limit: 5)
      expect(titles(result)).to eq(["Free one"])
      expect(result.exclusions["not_available"]).to eq(3)
      expect(result.picks.first.explanations.map { |e| e[:text] }).to include("Free to watch on Tubi.")
    end

    it "adds the user's own services for free_or_subscribed" do
      result = run(availability: "free_or_subscribed", region: "US", subscribed_provider_ids: [8], limit: 5)
      expect(titles(result)).to contain_exactly("Free one", "On Netflix")
      netflix = result.picks.find { |p| p.candidate.movie.title == "On Netflix" }
      expect(netflix.explanations.map { |e| e[:text] }).to include("On Netflix, which you have.")
    end

    it "does not filter by availability by default, but still mentions free options it knows about" do
      result = run(region: "US", limit: 5)
      expect(result.eligible_count).to eq(4)
      expect(result.picks.flat_map(&:explanations).map { |e| e[:code] }).to include("free_to_watch")
    end

    it "treats a different country's availability as unknown" do
      expect(run(availability: "free", region: "GB").picks).to be_empty
    end
  end
end

