import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { AppLayout } from '../components/layout'
import { ErrorState, Skeleton } from '../components/ui'
import { AuthPage } from '../features/auth/AuthPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { DiscoverPage } from '../features/discovery/DiscoverPage'
import { MoviePage, TmdbMoviePage } from '../features/movie/MoviePage'
import { WatchlistPage } from '../features/watchlist/WatchlistPage'
import { PlannerPage } from '../features/planner/PlannerPage'
import { ResultsPage } from '../features/results/ResultsPage'
import { HistoryPage } from '../features/history/HistoryPage'

function AuthGate() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: Infinity })
  if (me.isPending) return <div className="p-8"><Skeleton className="h-8 w-40" /></div>
  if (me.error instanceof ApiError && me.error.status === 401) return <AuthPage />
  if (me.error) return <div className="p-8"><ErrorState error={me.error} onRetry={() => me.refetch()} /></div>
  return <AppLayout user={me.data} />
}

export const router = createBrowserRouter([
  {
    element: <AuthGate />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/movies/tmdb/:tmdbId', element: <TmdbMoviePage /> },
      { path: '/movies/:id', element: <MoviePage /> },
      { path: '/watchlist', element: <WatchlistPage /> },
      { path: '/plan', element: <PlannerPage /> },
      { path: '/plan/results/:sessionId', element: <ResultsPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
