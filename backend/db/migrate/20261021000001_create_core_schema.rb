class CreateCoreSchema < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.timestamps
    end
    add_index :users, "lower(email)", unique: true, name: "index_users_on_lower_email"

    create_table :movies do |t|
      t.integer :tmdb_id
      t.string :source, null: false, default: "tmdb" # "tmdb" or "local" (built-in dev catalog)
      t.string :title, null: false
      t.string :original_title
      t.text :overview
      t.date :release_date
      t.integer :runtime_minutes
      t.string :poster_path
      t.string :backdrop_path
      t.string :original_language
      t.float :popularity, null: false, default: 0
      t.timestamps
    end
    add_index :movies, :tmdb_id, unique: true
    add_index :movies, :popularity
    add_check_constraint :movies, "runtime_minutes IS NULL OR (runtime_minutes > 0 AND runtime_minutes < 1000)", name: "movies_runtime_range"
    add_check_constraint :movies, "source IN ('tmdb', 'local')", name: "movies_source_valid"

    create_table :genres do |t|
      t.string :name, null: false
      t.integer :external_id
      t.timestamps
    end
    add_index :genres, :name, unique: true
    add_index :genres, :external_id, unique: true

    create_table :movie_genres do |t|
      t.references :movie, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :genre, null: false, foreign_key: { on_delete: :cascade }
    end
    add_index :movie_genres, %i[movie_id genre_id], unique: true

    create_table :watchlist_items do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :movie, null: false, foreign_key: true
      t.string :status, null: false, default: "want_to_watch"
      t.boolean :priority, null: false, default: false
      t.integer :personal_rating
      t.datetime :added_at, null: false
      t.datetime :last_interaction_at, null: false
      t.timestamps
    end
    add_index :watchlist_items, %i[user_id movie_id], unique: true
    add_index :watchlist_items, %i[user_id status]
    add_check_constraint :watchlist_items, "status IN ('want_to_watch', 'watching', 'paused', 'watched', 'abandoned')", name: "watchlist_items_status_valid"
    add_check_constraint :watchlist_items, "personal_rating IS NULL OR personal_rating BETWEEN 1 AND 10", name: "watchlist_items_rating_range"

    create_table :recommendation_sessions do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.integer :available_minutes, null: false
      t.string :mood
      t.integer :genre_ids, array: true, null: false, default: []
      t.string :viewing_context
      t.string :completion_preference, null: false
      t.boolean :include_abandoned, null: false, default: false
      t.integer :candidate_count, null: false, default: 0
      t.string :algorithm_version, null: false
      t.references :selected_movie, foreign_key: { to_table: :movies }
      t.datetime :selected_at
      t.timestamps
    end

    create_table :recommendation_items do |t|
      t.references :recommendation_session, null: false, foreign_key: { on_delete: :cascade }
      t.references :movie, null: false, foreign_key: true
      t.integer :rank, null: false
      t.decimal :total_score, precision: 6, scale: 4, null: false
      t.jsonb :score_components, null: false, default: {}
      t.jsonb :explanation_data, null: false, default: []
      t.datetime :selected_at
      t.datetime :dismissed_at
      t.datetime :created_at, null: false
    end
    add_index :recommendation_items, %i[recommendation_session_id movie_id], unique: true

    create_table :watch_sessions do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :movie, null: false, foreign_key: true
      t.references :watchlist_item, foreign_key: { on_delete: :nullify }
      t.references :recommendation_session, foreign_key: { on_delete: :nullify }
      t.datetime :started_at, null: false
      t.datetime :ended_at
      t.integer :minutes_watched
      t.string :outcome, null: false, default: "in_progress"
      t.string :viewing_context
      t.text :personal_feedback
      t.timestamps
    end
    add_index :watch_sessions, %i[user_id started_at]
    add_check_constraint :watch_sessions, "outcome IN ('in_progress', 'completed', 'paused', 'abandoned', 'interrupted')", name: "watch_sessions_outcome_valid"
    add_check_constraint :watch_sessions, "minutes_watched IS NULL OR minutes_watched >= 0", name: "watch_sessions_minutes_nonnegative"
    add_check_constraint :watch_sessions, "ended_at IS NULL OR ended_at >= started_at", name: "watch_sessions_end_after_start"
    # At most one open attempt per movie per user.
    add_index :watch_sessions, %i[user_id movie_id], unique: true, where: "outcome = 'in_progress'", name: "index_watch_sessions_one_open_per_movie"
  end
end
