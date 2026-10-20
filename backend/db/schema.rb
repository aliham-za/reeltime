# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_10_21_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "genres", force: :cascade do |t|
    t.string "name", null: false
    t.integer "external_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["external_id"], name: "index_genres_on_external_id", unique: true
    t.index ["name"], name: "index_genres_on_name", unique: true
  end

  create_table "movie_genres", force: :cascade do |t|
    t.bigint "movie_id", null: false
    t.bigint "genre_id", null: false
    t.index ["genre_id"], name: "index_movie_genres_on_genre_id"
    t.index ["movie_id", "genre_id"], name: "index_movie_genres_on_movie_id_and_genre_id", unique: true
  end

  create_table "movies", force: :cascade do |t|
    t.integer "tmdb_id"
    t.string "source", default: "tmdb", null: false
    t.string "title", null: false
    t.string "original_title"
    t.text "overview"
    t.date "release_date"
    t.integer "runtime_minutes"
    t.string "poster_path"
    t.string "backdrop_path"
    t.string "original_language"
    t.float "popularity", default: 0.0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["popularity"], name: "index_movies_on_popularity"
    t.index ["tmdb_id"], name: "index_movies_on_tmdb_id", unique: true
    t.check_constraint "runtime_minutes IS NULL OR runtime_minutes > 0 AND runtime_minutes < 1000", name: "movies_runtime_range"
    t.check_constraint "source::text = ANY (ARRAY['tmdb'::character varying, 'local'::character varying]::text[])", name: "movies_source_valid"
  end

  create_table "recommendation_items", force: :cascade do |t|
    t.bigint "recommendation_session_id", null: false
    t.bigint "movie_id", null: false
    t.integer "rank", null: false
    t.decimal "total_score", precision: 6, scale: 4, null: false
    t.jsonb "score_components", default: {}, null: false
    t.jsonb "explanation_data", default: [], null: false
    t.datetime "selected_at"
    t.datetime "dismissed_at"
    t.datetime "created_at", null: false
    t.index ["movie_id"], name: "index_recommendation_items_on_movie_id"
    t.index ["recommendation_session_id", "movie_id"], name: "idx_on_recommendation_session_id_movie_id_3bf1f0b22d", unique: true
    t.index ["recommendation_session_id"], name: "index_recommendation_items_on_recommendation_session_id"
  end

  create_table "recommendation_sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.integer "available_minutes", null: false
    t.string "mood"
    t.integer "genre_ids", default: [], null: false, array: true
    t.string "viewing_context"
    t.string "completion_preference", null: false
    t.boolean "include_abandoned", default: false, null: false
    t.integer "candidate_count", default: 0, null: false
    t.string "algorithm_version", null: false
    t.bigint "selected_movie_id"
    t.datetime "selected_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["selected_movie_id"], name: "index_recommendation_sessions_on_selected_movie_id"
    t.index ["user_id"], name: "index_recommendation_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
  end

  create_table "watch_sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "movie_id", null: false
    t.bigint "watchlist_item_id"
    t.bigint "recommendation_session_id"
    t.datetime "started_at", null: false
    t.datetime "ended_at"
    t.integer "minutes_watched"
    t.string "outcome", default: "in_progress", null: false
    t.string "viewing_context"
    t.text "personal_feedback"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["movie_id"], name: "index_watch_sessions_on_movie_id"
    t.index ["recommendation_session_id"], name: "index_watch_sessions_on_recommendation_session_id"
    t.index ["user_id", "movie_id"], name: "index_watch_sessions_one_open_per_movie", unique: true, where: "((outcome)::text = 'in_progress'::text)"
    t.index ["user_id", "started_at"], name: "index_watch_sessions_on_user_id_and_started_at"
    t.index ["user_id"], name: "index_watch_sessions_on_user_id"
    t.index ["watchlist_item_id"], name: "index_watch_sessions_on_watchlist_item_id"
    t.check_constraint "ended_at IS NULL OR ended_at >= started_at", name: "watch_sessions_end_after_start"
    t.check_constraint "minutes_watched IS NULL OR minutes_watched >= 0", name: "watch_sessions_minutes_nonnegative"
    t.check_constraint "outcome::text = ANY (ARRAY['in_progress'::character varying, 'completed'::character varying, 'paused'::character varying, 'abandoned'::character varying, 'interrupted'::character varying]::text[])", name: "watch_sessions_outcome_valid"
  end

  create_table "watchlist_items", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "movie_id", null: false
    t.string "status", default: "want_to_watch", null: false
    t.boolean "priority", default: false, null: false
    t.integer "personal_rating"
    t.datetime "added_at", null: false
    t.datetime "last_interaction_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["movie_id"], name: "index_watchlist_items_on_movie_id"
    t.index ["user_id", "movie_id"], name: "index_watchlist_items_on_user_id_and_movie_id", unique: true
    t.index ["user_id", "status"], name: "index_watchlist_items_on_user_id_and_status"
    t.check_constraint "personal_rating IS NULL OR personal_rating >= 1 AND personal_rating <= 10", name: "watchlist_items_rating_range"
    t.check_constraint "status::text = ANY (ARRAY['want_to_watch'::character varying, 'watching'::character varying, 'paused'::character varying, 'watched'::character varying, 'abandoned'::character varying]::text[])", name: "watchlist_items_status_valid"
  end

  add_foreign_key "movie_genres", "genres", on_delete: :cascade
  add_foreign_key "movie_genres", "movies", on_delete: :cascade
  add_foreign_key "recommendation_items", "movies"
  add_foreign_key "recommendation_items", "recommendation_sessions", on_delete: :cascade
  add_foreign_key "recommendation_sessions", "movies", column: "selected_movie_id"
  add_foreign_key "recommendation_sessions", "users", on_delete: :cascade
  add_foreign_key "watch_sessions", "movies"
  add_foreign_key "watch_sessions", "recommendation_sessions", on_delete: :nullify
  add_foreign_key "watch_sessions", "users", on_delete: :cascade
  add_foreign_key "watch_sessions", "watchlist_items", on_delete: :nullify
  add_foreign_key "watchlist_items", "movies"
  add_foreign_key "watchlist_items", "users", on_delete: :cascade
end
