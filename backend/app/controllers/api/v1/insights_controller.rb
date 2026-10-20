module Api
  module V1
    class InsightsController < ApplicationController
      # Below these, a pattern is a coincidence, not an insight.
      MIN_FOR_AVERAGE = 3
      MIN_FOR_TOP_GENRE = 3

      def overview
        completed = current_user.watch_sessions.finished.includes(movie: :genres).to_a
        this_month = completed.select { |ws| ws.ended_at && ws.ended_at >= Time.current.beginning_of_month }
        insights = []

        if this_month.any?
          count = this_month.map(&:movie_id).uniq.size
          insights << { code: "watched_this_month", value: count, text: "You've watched #{count} #{'movie'.pluralize(count)} this month." }
        end

        runtimes = completed.uniq(&:movie_id).filter_map { |ws| ws.movie.runtime_minutes }
        if runtimes.size >= MIN_FOR_AVERAGE
          average = (runtimes.sum / runtimes.size.to_f).round
          insights << { code: "average_runtime", value: average, text: "Your average finished movie runs #{average} minutes." }
        end

        if this_month.size >= MIN_FOR_TOP_GENRE
          tally = this_month.uniq(&:movie_id).flat_map { |ws| ws.movie.genres.map(&:name) }.tally
          top, second = tally.max_by(2, &:last)
          if top && top.last >= 2 && (second.nil? || top.last > second.last)
            insights << { code: "top_genre_month", value: top.first, text: "#{top.first} is your most-watched genre this month." }
          end
        end

        render json: { data: { completed_total: completed.map(&:movie_id).uniq.size, insights: } }
      end
    end
  end
end
