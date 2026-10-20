import type {
  Genre, InsightsOverview, Movie, Paged, RecommendationRequest, RecommendationSession, User,
  WatchSession, WatchlistItem, WatchlistSummary, WatchStatus, Outcome, ViewingContext,
} from '../types/api'

export class ApiError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown>

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  let res: Response
  try {
    res = await fetch(`/api/v1${path}${qs ? `?${qs}` : ''}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Can't reach ReelTime right now. Check your connection and try again.")
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = json.error ?? {}
    throw new ApiError(res.status, err.message ?? 'Something went wrong.', err.code, err.details)
  }
  return json as T
}

const get = <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query)
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const del = (path: string) => request<void>('DELETE', path)

type One<T> = { data: T }

export const api = {
  me: () => get<One<User>>('/me').then((r) => r.data),
  login: (email: string, password: string) => post<One<User>>('/auth/login', { user: { email, password } }).then((r) => r.data),
  register: (email: string, password: string) => post<One<User>>('/auth/register', { user: { email, password } }).then((r) => r.data),
  logout: () => del('/auth/logout'),

  genres: () => get<One<Genre[]>>('/genres').then((r) => r.data),
  movie: (id: number) => get<One<Movie>>(`/movies/${id}`).then((r) => r.data),
  tmdbMovie: (tmdbId: number) => get<One<Movie>>(`/movies/tmdb/${tmdbId}`).then((r) => r.data),
  searchMovies: (q: string, page = 1) => get<Paged<Movie>>('/movies/search', { q, page }),
  popularMovies: (page = 1) => get<Paged<Movie>>('/movies/popular', { page }),

  watchlist: (query: { status?: string; genre_id?: number; q?: string; sort?: string; page?: number; per_page?: number } = {}) =>
    get<Paged<WatchlistItem>>('/watchlist', query),
  watchlistItem: (id: number) => get<One<WatchlistItem>>(`/watchlist/${id}`).then((r) => r.data),
  watchlistSummary: () => get<One<WatchlistSummary>>('/watchlist/summary').then((r) => r.data),
  addToWatchlist: (movie: Pick<Movie, 'id' | 'tmdb_id'>) =>
    post<One<WatchlistItem>>('/watchlist', movie.id ? { movie_id: movie.id } : { tmdb_id: movie.tmdb_id }).then((r) => r.data),
  updateWatchlistItem: (id: number, changes: Partial<{ status: WatchStatus; priority: boolean; personal_rating: number | null }>) =>
    patch<One<WatchlistItem>>(`/watchlist/${id}`, { watchlist_item: changes }).then((r) => r.data),
  removeFromWatchlist: (id: number) => del(`/watchlist/${id}`),

  previewCount: (q: { available_minutes: number; completion_preference: string; include_abandoned?: boolean }) =>
    get<One<{ eligible_count: number }>>('/recommendations/preview', q).then((r) => r.data.eligible_count),
  recommend: (body: RecommendationRequest) => post<One<RecommendationSession>>('/recommendations', body).then((r) => r.data),
  recommendation: (id: number) => get<One<RecommendationSession>>(`/recommendations/${id}`).then((r) => r.data),
  chooseRecommendation: (id: number, movieId: number) =>
    post<One<RecommendationSession>>(`/recommendations/${id}/select`, { movie_id: movieId }).then((r) => r.data),
  dismissRecommendation: (id: number, movieId: number) =>
    post<One<RecommendationSession>>(`/recommendations/${id}/dismiss`, { movie_id: movieId }).then((r) => r.data),

  watchSessions: (query: { outcome?: string; movie_id?: number; page?: number; per_page?: number } = {}) =>
    get<Paged<WatchSession>>('/watch_sessions', query),
  startWatching: (body: { movie_id: number; recommendation_session_id?: number; viewing_context?: ViewingContext | null; outcome?: Outcome }) =>
    post<One<WatchSession> & { meta?: { resumed?: boolean } }>('/watch_sessions', body),
  updateWatchSession: (id: number, changes: Partial<Pick<WatchSession, 'outcome' | 'minutes_watched' | 'personal_feedback'>>) =>
    patch<One<WatchSession>>(`/watch_sessions/${id}`, { watch_session: changes }).then((r) => r.data),

  insights: () => get<One<InsightsOverview>>('/insights/overview').then((r) => r.data),
}
