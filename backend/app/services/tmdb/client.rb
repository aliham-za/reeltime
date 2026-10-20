require "net/http"

module Tmdb
  # Thin HTTP wrapper around the TMDB v3 API. Provider-specific; nothing outside MovieCatalog uses it.
  # Auth: TMDB_API_TOKEN (v4 read access token, preferred) or TMDB_API_KEY (v3 key), server-side only.
  class Client
    BASE_URL = "https://api.themoviedb.org/3".freeze
    TIMEOUT = 5

    def self.configured? = ENV["TMDB_API_TOKEN"].present? || ENV["TMDB_API_KEY"].present?

    def search(query, page: 1) = get("/search/movie", query:, page:, include_adult: false)
    def popular(page: 1) = get("/movie/popular", page:)
    def movie(tmdb_id) = get("/movie/#{Integer(tmdb_id)}")

    # Filtered browse across the whole catalog. TMDB stores unknown runtimes as 0, so a runtime cap
    # also requires >= 1 minute; the vote floor keeps near-empty entries out of the list.
    def discover(page: 1, genre_id: nil, year: nil, max_runtime: nil)
      params = { page:, sort_by: "popularity.desc", include_adult: false, "vote_count.gte": 10 }
      params[:with_genres] = genre_id if genre_id
      params[:primary_release_year] = year if year
      params.merge!("with_runtime.gte": 1, "with_runtime.lte": max_runtime) if max_runtime
      get("/discover/movie", params)
    end

    private

    def get(path, params = {})
      raise NotConfigured, "TMDB credentials are not configured" unless self.class.configured?

      params = params.merge(api_key: ENV["TMDB_API_KEY"]) if ENV["TMDB_API_TOKEN"].blank?
      uri = URI("#{BASE_URL}#{path}")
      uri.query = URI.encode_www_form(params.merge(language: "en-US"))

      Rails.cache.fetch(["tmdb", uri.to_s], expires_in: 6.hours) do
        request = Net::HTTP::Get.new(uri)
        request["Accept"] = "application/json"
        request["Authorization"] = "Bearer #{ENV['TMDB_API_TOKEN']}" if ENV["TMDB_API_TOKEN"].present?
        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: TIMEOUT, read_timeout: TIMEOUT) do |http|
          http.request(request)
        end
        case response
        when Net::HTTPSuccess then JSON.parse(response.body)
        when Net::HTTPTooManyRequests then raise Error, "TMDB rate limit reached, try again shortly"
        when Net::HTTPNotFound then raise Error, "Movie not found on TMDB"
        else raise Error, "TMDB request failed (#{response.code})"
        end
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, OpenSSL::SSL::SSLError => e
      raise Error, "TMDB is unreachable (#{e.class.name.demodulize})"
    end
  end
end
