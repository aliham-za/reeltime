import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { invalidateLibrary } from '../../lib/query-client'
import { formatDate, formatRuntime, OUTCOME_LABELS, STATUS_LABELS } from '../../lib/format'
import { WATCH_STATUSES, type Movie, type WatchSession, type WatchStatus } from '../../types/api'
import { Button, ErrorState, inputClass, Skeleton } from '../../components/ui'
import { Poster, StatusBadge } from '../../components/movies'
import { WhereToWatch } from '../../components/where-to-watch'
import { ConfirmDialog } from '../../components/dialog'
import { PlayIcon, PlusIcon, StarIcon } from '../../components/icons'
import { useToast } from '../../components/toast'
import { useWatchlistActions } from '../watchlist/useWatchlistActions'
import { CompletionDialog } from '../history/CompletionDialog'

export function MoviePage() {
  const id = Number(useParams().id)
  const movie = useQuery({ queryKey: ['movie', id], queryFn: () => api.movie(id) })
  if (movie.isPending) return <MovieSkeleton />
  if (movie.error) return <ErrorState error={movie.error} onRetry={() => movie.refetch()} />
  return <MovieDetails movie={movie.data} />
}

/** TMDB results are imported (runtime + genres) on first open, then shown like any other movie. */
export function TmdbMoviePage() {
  const tmdbId = Number(useParams().tmdbId)
  const movie = useQuery({ queryKey: ['movie', 'tmdb', tmdbId], queryFn: () => api.tmdbMovie(tmdbId) })
  if (movie.isPending) return <MovieSkeleton />
  if (movie.error) return <ErrorState error={movie.error} onRetry={() => movie.refetch()} />
  return <MovieDetails movie={movie.data} />
}

function MovieSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:flex-row" role="status" aria-label="Loading movie">
      <Skeleton className="aspect-[2/3] w-56" />
      <div className="flex-1 space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-24 w-full" /></div>
    </div>
  )
}

function MovieDetails({ movie }: { movie: Movie }) {
  const movieId = movie.id!
  const toast = useToast()
  const navigate = useNavigate()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { add, update, remove } = useWatchlistActions()

  const attempts = useQuery({ queryKey: ['watch-sessions', 'movie', movieId], queryFn: () => api.watchSessions({ movie_id: movieId }) })
  const item = movie.watchlist_item
  const openAttempt = attempts.data?.data.find((s) => s.outcome === 'in_progress') ?? null
  const [reporting, setReporting] = useState<WatchSession | null>(null)

  const start = useMutation({
    mutationFn: () => api.startWatching({ movie_id: movieId }),
    onSuccess: async (r) => {
      await invalidateLibrary()
      toast(r.meta?.resumed ? 'Picking up where you left off.' : 'Enjoy the movie.')
      navigate('/history')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null

  return (
    <div>
      {backdrop && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden md:left-60">
          <img src={backdrop} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 to-canvas" />
        </div>
      )}
      <div className="flex flex-col gap-8 md:flex-row">
        <Poster movie={movie} size="w500" className="mx-auto w-40 shrink-0 sm:w-52 md:mx-0 md:w-64" />
        <div className="max-w-2xl flex-1">
          {item && <StatusBadge status={item.status} />}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{movie.title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-2 text-fg-2">
            {movie.release_year && <span>{movie.release_year}</span>}
            <span aria-hidden className="text-muted">·</span>
            <span className="tabular-nums">{formatRuntime(movie.runtime_minutes)}</span>
            {movie.source === 'local' && <><span aria-hidden className="text-muted">·</span><span className="text-violet">Sample catalog</span></>}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {movie.genres.map((g) => <span key={g.id} className="rounded-md bg-elevated px-2.5 py-1 text-sm text-fg-2">{g.name}</span>)}
          </div>
          {movie.overview && <p className="mt-6 leading-relaxed text-fg-2">{movie.overview}</p>}
          {movie.tmdb_id && <WhereToWatch movieId={movieId} />}

          <div className="mt-8 flex flex-wrap gap-2">
            {item ? (
              <>
                {openAttempt ? (
                  <Button size="lg" onClick={() => setReporting(openAttempt)}>How did it go?</Button>
                ) : item.status !== 'watched' && (
                  <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>
                    <PlayIcon width={16} height={16} /> {item.status === 'paused' ? 'Resume watching' : 'Start watching'}
                  </Button>
                )}
                <Button variant="secondary" size="lg" aria-pressed={item.priority} onClick={() => update.mutate({ id: item.id, priority: !item.priority })}>
                  <StarIcon filled={item.priority} width={16} height={16} className={item.priority ? 'text-accent' : ''} /> {item.priority ? 'Priority' : 'Mark as priority'}
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={() => add.mutate(movie)} disabled={add.isPending}><PlusIcon width={16} height={16} /> Add to watchlist</Button>
            )}
          </div>

          {item && (
            <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
              <label className="text-sm text-fg-2">
                Status
                <select value={item.status} onChange={(e) => update.mutate({ id: item.id, status: e.target.value as WatchStatus })} className={`${inputClass} mt-1.5`}>
                  {WATCH_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </label>
              <label className="text-sm text-fg-2">
                Your rating
                <select
                  value={item.personal_rating ?? ''}
                  onChange={(e) => update.mutate({ id: item.id, personal_rating: e.target.value ? Number(e.target.value) : null })}
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="">No rating</option>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n} / 10</option>)}
                </select>
              </label>
            </div>
          )}

          {item && (
            <button type="button" onClick={() => setConfirmRemove(true)} className="mt-4 text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
              Remove from watchlist
            </button>
          )}

          {(attempts.data?.data.length ?? 0) > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-base font-semibold">Your attempts</h2>
              <ul className="space-y-1.5 text-sm">
                {attempts.data!.data.map((s) => (
                  <li key={s.id} className="flex justify-between gap-4 rounded-lg bg-surface px-3 py-2">
                    <span>{OUTCOME_LABELS[s.outcome]}</span>
                    <span className="text-muted">{formatDate(s.started_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <CompletionDialog session={reporting} onClose={() => setReporting(null)} />
      <ConfirmDialog
        open={confirmRemove}
        title="Remove from watchlist?"
        message={`${movie.title} will be removed. Your past viewing history stays.`}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => { if (item) remove.mutate(item.id); setConfirmRemove(false) }}
      />
    </div>
  )
}
