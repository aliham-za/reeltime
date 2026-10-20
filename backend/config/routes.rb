Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      post "auth/register", to: "auth#register"
      post "auth/login", to: "auth#login"
      delete "auth/logout", to: "auth#logout"
      get "me", to: "auth#me"

      resources :genres, only: :index
      resources :movies, only: %i[index show] do
        collection do
          get :search
          get :popular
          get :discover
          get "tmdb/:tmdb_id", action: :tmdb, as: :tmdb
        end
      end
      resources :watchlist, controller: "watchlist_items", only: %i[index show create update destroy] do
        get :summary, on: :collection
      end
      resources :recommendations, only: %i[create show] do
        get :preview, on: :collection
        member do
          post :select, action: :choose
          post :dismiss
        end
      end
      resources :watch_sessions, only: %i[index show create update]
      get "insights/overview", to: "insights#overview"
    end
  end
end
