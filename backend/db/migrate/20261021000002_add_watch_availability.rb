class AddWatchAvailability < ActiveRecord::Migration[7.2]
  def change
    # Where the user watches from and which subscription services they have (TMDB provider ids).
    add_column :users, :country, :string, limit: 2, null: false, default: "US"
    add_column :users, :subscribed_provider_ids, :integer, array: true, null: false, default: []

    # Per-movie, per-country "where to watch" snapshot from TMDB/JustWatch, refreshed when stale.
    # Empty groups are stored too, so "not available here" is cached as well.
    create_table :movie_availabilities do |t|
      t.references :movie, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :region, limit: 2, null: false
      t.string :link
      t.jsonb :providers, null: false, default: {}
      t.datetime :fetched_at, null: false
    end
    add_index :movie_availabilities, %i[movie_id region], unique: true

    add_column :recommendation_sessions, :availability, :string, null: false, default: "anywhere"
    add_column :recommendation_sessions, :region, :string, limit: 2
  end
end
