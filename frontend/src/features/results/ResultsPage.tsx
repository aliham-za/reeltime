import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { invalidateLibrary, queryClient } from '../../lib/query-client'
import { CONTEXT_OPTIONS, formatRuntime, MOOD_OPTIONS } from '../../lib/format'
import type { Genre, RecommendationItem, RecommendationSession } from '../../types/api'
import { Button, ButtonLink, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { GenreBadges, movieHref, Poster } from '../../components/movies'
import { CheckIcon, ClockIcon, PlayIcon } from '../../components/icons'
import { useToast } from '../../components/toast'

export function plannerLink(c: RecommendationSession['constraints']) {
  const params = new URLSearchParams({ minutes: String(c.available_minutes), completion: c.completion_preference })
  if (c.mood) params.set('mood', c.mood)
  if (c.genre_ids.length) params.set('genres', c.genre_ids.join(','))
  if (c.viewing_context) params.set('context', c.viewing_context)
  return `/plan?${params}`
}

export function ResultsPage() {
  const sessionId = Number(useParams().sessionId)
  const session = useQuery({ queryKey: ['recommendation', sessionId], queryFn: () => api.recommendation(sessionId) })
  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })

  if (session.isPending) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading recommendations">
        <Skeleton className="h-10 w-72" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 w-full" />)}
      </div>
    )
  }
  if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const data = session.data
  const visible = data.items.filter((i) => !i.dismissed_at)

  return (
    <div className="mx-auto max-w-5xl">
      <ConstraintsBar session={data} genres={genres.data ?? []} />
      {data.items.length === 0 ? (
        <NoMatches session={data} />
      ) : visible.length === 0 ? (
        <EmptyState title="That's everything that fits tonight." description="Try a different window or mood, or come back to these another time.">
          <ButtonLink to={plannerLink(data.constraints)}>Adjust my time</ButtonLink>
          <ButtonLink to="/discover" variant="secondary">Discover movies</ButtonLink>
        </EmptyState>
      ) : (
        <>
          <header className="mb-8 mt-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your next movie night</h1>
            <p className="mt-2 text-fg-2">
              {visible.length === 1 && data.items.length === 1
                ? 'One movie fits everything you asked for. It\'s a good one to commit to.'
                : 'Here are a few movies that fit your time and preferences.'}
            </p>
          </header>
          <ol className="space-y-5">
            {visible.map((item) => (
              <li key={item.id}><RecommendationCard item={item} session={data} /></li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function ConstraintsBar({ session, genres }: { session: RecommendationSession; genres: Genre[] }) {
  const c = session.constraints
  const parts = [
    formatRuntime(c.available_minutes),
    { single_sitting: 'One sitting', open_to_longer: 'Open to longer', continue_started: 'Continuing' }[c.completion_preference],
    c.mood && c.mood !== 'anything' ? MOOD_OPTIONS.find((m) => m.value === c.mood)?.label : null,
    c.genre_ids.length ? genres.filter((g) => c.genre_ids.includes(g.id)).map((g) => g.name).join(', ') : null,
    c.viewing_context ? CONTEXT_OPTIONS.find((o) => o.value === c.viewing_context)?.label : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <ClockIcon className="text-accent" width={18} height={18} />
        {parts.map((p, i) => (
          <span key={i} className={i === 0 ? 'font-semibold tabular-nums text-fg' : 'text-fg-2'}>{i > 0 && <span aria-hidden className="mr-3 text-muted">·</span>}{p}</span>
        ))}
      </p>
      <Link to={plannerLink(c)} className="text-sm font-medium text-accent hover:underline">Adjust</Link>
    </div>
  )
}

function NoMatches({ session }: { session: RecommendationSession }) {
  const c = session.constraints
  const ex = session.exclusions
  const reasons = [
    ex?.too_long ? `${ex.too_long} ${ex.too_long === 1 ? 'movie runs' : 'movies run'} longer than ${c.available_minutes} minutes.` : null,
    ex?.missing_runtime ? `${ex.missing_runtime} ${ex.missing_runtime === 1 ? "doesn't" : "don't"} have a runtime listed, so we can't promise a finish.` : null,
  ].filter(Boolean)
  const continuing = c.completion_preference === 'continue_started'

  return (
    <div className="mt-8">
      <EmptyState
        icon={<ClockIcon width={32} height={32} />}
        title={continuing && !ex?.too_long ? "You don't have anything in progress." : 'Nothing fits your time window right now.'}
        description={continuing && !ex?.too_long ? 'Start something new instead. Your paused movies will show up here.' : 'Try a little more time or add a few shorter movies.'}
      >
        <ButtonLink to={plannerLink(c)}>Adjust my time</ButtonLink>
        <ButtonLink to="/discover" variant="secondary">Discover movies</ButtonLink>
      </EmptyState>
      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1 text-center text-sm text-muted">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      )}
    </div>
  )
}

function RecommendationCard({ item, session }: { item: RecommendationItem; session: RecommendationSession }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState(Boolean(item.selected_at))
  const movie = item.movie
  const movieId = movie.id!
  const update = (s: RecommendationSession) => queryClient.setQueryData(['recommendation', session.id], s)

  const choose = useMutation({
    mutationFn: () => api.chooseRecommendation(session.id, movieId),
    onSuccess: (s) => { update(s); setChosen(true) },
    onError: (e) => toast(e.message, 'error'),
  })
  const dismiss = useMutation({
    mutationFn: () => api.dismissRecommendation(session.id, movieId),
    onSuccess: update,
    onError: (e) => toast(e.message, 'error'),
  })
  const start = useMutation({
    mutationFn: () => api.startWatching({ movie_id: movieId, recommendation_session_id: session.id, viewing_context: session.constraints.viewing_context }),
    onSuccess: async (r) => {
      await invalidateLibrary()
      toast(r.meta?.resumed ? 'Picking up where you left off.' : 'Enjoy the movie. Tell us how it went when you\'re done.')
      navigate('/history')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const someoneElseChosen = session.selected_movie_id !== null && session.selected_movie_id !== movieId

  return (
    <article
      aria-labelledby={`rec-${item.id}`}
      className={`flex animate-rise flex-col gap-5 rounded-3xl border bg-card p-4 transition-opacity sm:flex-row sm:p-5 ${
        chosen ? 'border-accent/60' : 'border-line'
      } ${someoneElseChosen ? 'opacity-55' : ''}`}
      style={{ animationDelay: `${(item.rank - 1) * 60}ms` }}
    >
      <Link to={movieHref(movie)} className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
        <Poster movie={movie} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-medium text-accent">{item.headline}</p>
        <h2 id={`rec-${item.id}`} className="mt-1 text-2xl font-semibold tracking-tight">{movie.title}</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
          <span className="tabular-nums text-fg">{formatRuntime(movie.runtime_minutes)}</span>
          {movie.release_year && <><span aria-hidden className="text-muted">·</span>{movie.release_year}</>}
          <span aria-hidden className="text-muted">·</span>
          <GenreBadges genres={movie.genres} max={3} />
        </p>
        {movie.overview && <p className="mt-3 line-clamp-3 max-w-prose text-sm text-fg-2">{movie.overview}</p>}

        <div className="mt-4">
          <h3 className="sr-only">Why it fits</h3>
          <ul className="space-y-1.5">
            {item.reasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-sm">
                <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-accent" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-auto sm:pt-5">
          {chosen ? (
            <>
              <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>
                <PlayIcon width={16} height={16} /> {start.isPending ? 'Starting…' : 'Start watching now'}
              </Button>
              <span className="text-sm text-fg-2" role="status">Good choice. Enjoy the movie.</span>
            </>
          ) : (
            <>
              <Button size="lg" onClick={() => choose.mutate()} disabled={choose.isPending}>Let's watch this</Button>
              <Button variant="ghost" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>Not tonight</Button>
              <Link to={movieHref(movie)} className="px-2 text-sm text-fg-2 underline-offset-4 hover:text-fg hover:underline">View details</Link>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
