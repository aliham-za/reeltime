# Idempotent development seeds: `bin/rails db:seed`.
#
# Genres use TMDB's genre IDs so locally seeded movies and TMDB imports share one genre table.
#
# With TMDB credentials, the development account's watchlist is filled with real popular movies.
# Without them, a FICTIONAL sample catalog (invented titles, source "local") is created instead so
# the app still works end to end offline. It is never presented as provider data.

GENRES = {
  28 => "Action", 12 => "Adventure", 16 => "Animation", 35 => "Comedy", 80 => "Crime",
  99 => "Documentary", 18 => "Drama", 10751 => "Family", 14 => "Fantasy", 36 => "History",
  27 => "Horror", 10402 => "Music", 9648 => "Mystery", 10749 => "Romance",
  878 => "Science Fiction", 10770 => "TV Movie", 53 => "Thriller", 10752 => "War", 37 => "Western"
}.freeze

GENRES.each do |external_id, name|
  Genre.find_or_create_by!(external_id:) { |g| g.name = name }
end

# [title, year, runtime, genres, overview]
SAMPLE_CATALOG = [
  ["The Lantern Keeper", 2019, 94, %w[Drama Mystery], "A lighthouse keeper on a remote island starts receiving letters from a ship that sank decades ago."],
  ["Paper Moons", 2021, 82, %w[Comedy Romance], "Two rival origami artists are forced to share a booth at a craft fair that neither can afford to lose."],
  ["Velocity Drift", 2018, 118, %w[Action Thriller], "A retired getaway driver is pulled back for one last job across three countries in one night."],
  ["Small Hours", 2022, 72, %w[Comedy], "An overnight shift at a 24-hour laundromat turns into the strangest night of a student's life."],
  ["The Cartographer's Daughter", 2017, 131, %w[Adventure Drama], "A young mapmaker sets out to finish her father's survey of an uncharted mountain range."],
  ["Static Bloom", 2023, 104, ["Science Fiction", "Mystery"], "A radio astronomer detects a signal that seems to predict the weather a week in advance."],
  ["Kettle & Crumb", 2020, 88, %w[Animation Family Comedy], "A teapot and a biscuit tin team up to save their village bakery from a mechanical rival."],
  ["Northbound", 2016, 97, %w[Drama], "Three estranged siblings drive their late mother's van from Lisbon to the Arctic Circle."],
  ["Hollow Signal", 2021, 89, %w[Horror Thriller], "A cell tower repair crew becomes stranded on a mountain where the static starts talking back."],
  ["The Quiet Heist", 2019, 109, %w[Crime Comedy], "A team of museum night guards plans to rob their own museum without anyone noticing a thing."],
  ["Afterglow Avenue", 2022, 115, %w[Romance Drama], "A street photographer and a jazz pianist keep missing each other across one summer in the city."],
  ["Iron Tide", 2015, 142, %w[War Drama History], "A shipyard welder's letters home chart the slow transformation of a coastal town at war."],
  ["Glimmerwood", 2020, 101, %w[Fantasy Adventure Family], "A boy follows a trail of glowing acorns into a forest where seasons are traded like coins."],
  ["Under the Floorboards", 2018, 78, %w[Horror Mystery], "New homeowners find a diary hidden beneath their kitchen that describes their own move-in day."],
  ["Second Serve", 2023, 99, %w[Comedy Drama], "A washed-up tennis pro coaches a retirement home team to an unlikely regional tournament."],
  ["Deep Field", 2017, 126, ["Science Fiction", "Drama"], "The crew of a long-haul survey vessel must decide whether to answer a distress call from Earth."],
  ["Fault Lines", 2021, 112, %w[Thriller Crime], "A seismologist uncovers a cover-up after a minor tremor exposes a sealed tunnel under the city."],
  ["The Long Table", 2019, 64, %w[Documentary], "A year inside a family-run restaurant that has served the same street for four generations."],
  ["Wild Honey", 2022, 91, %w[Romance Comedy], "A beekeeper's carefully planned life is upended when a celebrity chef rents the farmhouse next door."],
  ["Midnight Ferry", 2016, 86, %w[Mystery Thriller], "Passengers on the last ferry of the night realise one of them was not on the boarding list."],
  ["Brass Hearts", 2020, 123, %w[Music Drama], "A failing brass band from a mining town gets one shot at the national championship."],
  ["The Snow Kite", 2018, 76, %w[Animation Family Adventure], "A girl builds a kite that can carry her above the clouds to find her missing grandfather."],
  ["Overclocked", 2023, 95, ["Action", "Science Fiction"], "A courier with a neural implant has twelve hours before the upgrade burns out her memory."],
  ["Last Light at Marrow Creek", 2015, 137, %w[Western Drama], "An aging sheriff and a young outlaw are forced to cross a desert together to reach the same trial."],
  ["Five-Minute Friends", 2021, 58, %w[Comedy Family], "A speed-friending event goes wrong when the organiser locks everyone in until they find a match."],
  ["Rooms of Water", 2017, 103, %w[Drama Fantasy], "After a flood, a widower discovers that each room of his house remembers a different year."],
  ["Coldcase Kitchen", 2022, 84, %w[Crime Comedy Mystery], "A retired detective solves cold cases through the recipes victims left behind."],
  ["Echo Valley", 2019, 148, %w[Adventure Drama], "A mountain rescue team spends a winter searching for a climber whose radio still answers every night."],
  ["The Marigold Clause", 2020, 107, %w[Drama Romance], "A wedding planner discovers a clause in a client's prenup that could reunite her with her first love."],
  ["Signal Fires", 2023, 69, %w[Documentary History], "Volunteers rebuild a chain of hilltop beacons and trace the stories of the people who once lit them."],
  ["Night Shift at the Planetarium", 2018, 92, ["Comedy", "Science Fiction"], "A planetarium janitor accidentally becomes humanity's only contact with a lost alien probe."],
  ["The Unfinished Portrait", 2016, 119, %w[Mystery Drama], "An art restorer realises the painting she is cleaning was painted over a portrait of herself."]
].freeze

def seed_sample_catalog
  genres_by_name = Genre.all.index_by(&:name)
  SAMPLE_CATALOG.each_with_index.map do |(title, year, runtime, genre_names, overview), index|
    movie = Movie.find_or_initialize_by(source: "local", title:)
    movie.update!(
      release_date: Date.new(year, 1 + (index % 12), 1),
      runtime_minutes: runtime,
      overview:,
      original_title: title,
      original_language: "en",
      popularity: (SAMPLE_CATALOG.size - index).to_f
    )
    movie.genres = genre_names.map { |name| genres_by_name.fetch(name) }
    movie
  end
end

# Imports popular TMDB movies (details call per movie, for runtime and genres).
def seed_from_tmdb(count)
  catalog = MovieCatalog.new
  Tmdb::Client.new.popular["results"].first(count).filter_map do |result|
    catalog.import(result["id"])
  rescue Tmdb::Error => e
    warn "Skipped TMDB movie #{result['id']}: #{e.message}"
    nil
  end
end

movies = if Tmdb::Client.configured?
  seed_from_tmdb(16)
else
  seed_sample_catalog
end

# Development profile. Test-only credentials; never use this account outside local development.
if Rails.env.development?
  demo = User.find_or_initialize_by(email: "demo@reeltime.test")
  demo.update!(password: "watchmore123") if demo.new_record?

  movies.each_with_index do |movie, index|
    demo.watchlist_items.find_or_create_by!(movie:) do |item|
      item.priority = (index % 5).zero?
      item.added_at = (movies.size - index).days.ago
    end
  end

  puts "Demo account: demo@reeltime.test / watchmore123"
end

puts "Seeded #{Genre.count} genres and #{movies.size} #{Tmdb::Client.configured? ? 'TMDB' : 'sample'} movies."
