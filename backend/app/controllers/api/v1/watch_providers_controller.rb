module Api
  module V1
    # Countries and streaming services TMDB/JustWatch know about, for the settings page.
    class WatchProvidersController < ApplicationController
      def regions
        regions = Tmdb::Client.new.watch_regions["results"]
                              .map { |r| { code: r["iso_3166_1"], name: r["english_name"] } }
                              .sort_by { |r| r[:name] }
        render json: { data: regions }
      end

      def index
        region = params[:region].to_s.upcase
        return render_error(:unprocessable_content, "Invalid country", code: "validation_failed") unless region.match?(/\A[A-Z]{2}\z/)

        providers = Tmdb::Client.new.provider_catalog(region)["results"]
                                .sort_by { |p| p.dig("display_priorities", region) || p["display_priority"].to_i }
                                .map { |p| { id: p["provider_id"], name: p["provider_name"], logo_path: p["logo_path"] } }
        render json: { data: providers }
      end
    end
  end
end
