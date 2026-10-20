require "rails_helper"

RSpec.describe "Insights", type: :request do
  let(:user) { create_user }

  before { sign_in(user) }

  def complete!(movie)
    user.watch_sessions.create!(movie:, started_at: 2.hours.ago, ended_at: 1.minute.ago, outcome: "completed")
  end

  it "shows nothing when there is no history" do
    get "/api/v1/insights/overview"
    expect(json["data"]).to eq("completed_total" => 0, "insights" => [])
  end

  it "does not generalize from a single viewing" do
    complete!(create_movie(runtime: 80, genres: ["Comedy"]))
    get "/api/v1/insights/overview"
    expect(json.dig("data", "insights").map { |i| i["code"] }).to eq(["watched_this_month"])
  end

  it "adds averages and top genre once there is enough data" do
    [90, 100, 110].each { |runtime| complete!(create_movie(runtime:, genres: ["Comedy"])) }
    get "/api/v1/insights/overview"
    insights = json.dig("data", "insights").index_by { |i| i["code"] }
    expect(insights["average_runtime"]["value"]).to eq(100)
    expect(insights["top_genre_month"]["value"]).to eq("Comedy")
  end
end
