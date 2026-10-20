export type Genre = { id: number; name: string }

export type Movie = {
  id: number | null // null for TMDB search results not yet imported
  tmdb_id: number | null
  source: 'tmdb' | 'local'
  title: string
  original_title: string | null
  overview: string | null
  release_date: string | null
  release_year: number | null
  runtime_minutes: number | null
  poster_path: string | null
  backdrop_path: string | null
  original_language: string | null
  genres: Genre[]
  watchlist_item_id?: number | null // on search/popular results
  watchlist_item?: Pick<WatchlistItem, 'id' | 'status' | 'priority' | 'personal_rating'> | null // on single-movie views
}

export const WATCH_STATUSES = ['want_to_watch', 'watching', 'paused', 'watched', 'abandoned'] as const
export type WatchStatus = (typeof WATCH_STATUSES)[number]

export type WatchlistItem = {
  id: number
  status: WatchStatus
  priority: boolean
  personal_rating: number | null
  added_at: string
  last_interaction_at: string
  movie: Movie
}

export type WatchlistSummary = {
  total: number
  by_status: Record<WatchStatus, number>
  fits_window: Record<string, number>
}

export type Mood = 'lighthearted' | 'exciting' | 'thought_provoking' | 'emotional' | 'suspenseful' | 'comfort' | 'anything'
export type ViewingContext = 'alone' | 'date_night' | 'friends' | 'family'
export type CompletionPreference = 'single_sitting' | 'open_to_longer' | 'continue_started'

export type RecommendationRequest = {
  available_minutes: number
  mood?: Mood
  genre_ids?: number[]
  viewing_context?: ViewingContext
  completion_preference: CompletionPreference
  include_abandoned?: boolean
}

export type Reason = { code: string; text: string }

export type RecommendationItem = {
  id: number
  rank: number
  total_score: number
  score_components: Record<string, { score: number; weight: number }>
  headline: string
  reasons: Reason[]
  selected_at: string | null
  dismissed_at: string | null
  movie: Movie
}

export type RecommendationSession = {
  id: number
  created_at: string
  algorithm_version: string
  constraints: Required<Omit<RecommendationRequest, 'mood' | 'viewing_context'>> & {
    mood: Mood | null
    viewing_context: ViewingContext | null
  }
  candidate_count: number
  exclusions: { too_long: number; missing_runtime: number } | null
  selected_movie_id: number | null
  items: RecommendationItem[]
}

export const OUTCOMES = ['in_progress', 'completed', 'paused', 'abandoned', 'interrupted'] as const
export type Outcome = (typeof OUTCOMES)[number]

export type WatchSession = {
  id: number
  outcome: Outcome
  started_at: string
  ended_at: string | null
  minutes_watched: number | null
  viewing_context: ViewingContext | null
  personal_feedback: string | null
  recommendation_session_id: number | null
  watchlist_item_id: number | null
  movie: Movie
}

export type Insight = { code: string; text: string; value: number | string }
export type InsightsOverview = { completed_total: number; insights: Insight[] }

export type User = { id: number; email: string; created_at: string }

export type PageMeta = { page: number; per_page?: number; total?: number; total_pages: number; source?: 'tmdb' | 'local'; notice?: string }
export type Paged<T> = { data: T[]; meta: PageMeta }
