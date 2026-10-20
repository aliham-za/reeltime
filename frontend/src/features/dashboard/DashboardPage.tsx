import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatRuntime } from '../../lib/format'
import type { WatchSession } from '../../types/api'
import { Button, ButtonLink, EmptyState, ErrorState, PosterGridSkeleton, Section, Skeleton } from '../../components/ui'
import { MovieCard, movieGridClass, movieHref, Poster } from '../../components/movies'
import { ClockIcon, ListIcon } from '../../components/icons'
import { CompletionDialog } from '../history/CompletionDialog'

export function DashboardPage() {
  const [reporting, setReporting] = useState<WatchSession | null>(null)
  const summary = useQuery({ queryKey: ['watchlist-summary'], queryFn: api.watchlistSummary })
  const recent = useQuery({ queryKey: ['watchlist', 'recent'], queryFn: () => api.watchlist({ sort: 'recent', per_page: 6 }) })
  const open = useQuery({ queryKey: ['watch-sessions', 'open'], queryFn: () => api.watchSessions({ outcome: 'in_progress' }) })
  const watched = useQuery({ queryKey: ['watch-sessions', 'recently-completed'], queryFn: () => api.watchSessions({ outcome: 'completed', per_page: 6 }) })
  const insights = useQuery({ queryKey: ['insights'], queryFn: api.insights })

  if (summary.error) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
  const s = summary.data

  return (
    <div>
      <CompletionDialog session={reporting} onClose={() => setReporting(null)} />

      <section className="rounded-3xl border border-line bg-surface p-6 sm:p-10">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Your next movie night starts here.</h1>
        <p className="mt-3 max-w-xl text-lg text-fg-2">Tell us how much time you have. We'll find a few good options.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/plan" size="lg"><ClockIcon width={18} height={18} /> Find my movie</ButtonLink>
          <ButtonLink to="/watchlist" size="lg" variant="secondary">Explore my watchlist</ButtonLink>
        </div>
      </section>

      {!s ? (
        <div className="mt-8 grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : s.total === 0 ? (
        <div className="mt-10">
          <EmptyState icon={<ListIcon width={32} height={32} />} title="Your watchlist is waiting for its first movie." description="Add a few movies you'd love to watch. We'll help you find the right one when the time comes.">
            <ButtonLink to="/discover">Discover movies</ButtonLink>
          </EmptyState>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="On your watchlist" value={s.total} />
            <Stat label="In progress" value={s.by_status.watching + s.by_status.paused} />
            <Stat label="Watched" value={s.by_status.watched} />
          </dl>

          {(open.data?.data.length ?? 0) > 0 && (
            <Section title="Watching now" action={<Link to="/history" className="text-sm text-fg-2 hover:text-fg">History</Link>}>
              <div className="grid gap-3 lg:grid-cols-2">
                {open.data!.data.map((ws) => (
                  <div key={ws.id} className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-card p-3">
                    <Link to={movieHref(ws.movie)} className="w-14 shrink-0"><Poster movie={ws.movie} /></Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ws.movie.title}</p>
                      <p className="text-sm tabular-nums text-fg-2">{formatRuntime(ws.movie.runtime_minutes)}</p>
                    </div>
                    <Button variant="secondary" onClick={() => setReporting(ws)}>How did it go?</Button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Fits your evening">
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(s.fits_window).map(([minutes, count]) => (
                <Link
                  key={minutes}
                  to={`/plan?minutes=${minutes}`}
                  className="group rounded-2xl border border-line bg-card p-5 transition-colors hover:border-accent/50"
                >
                  <p className="text-sm text-fg-2">Got <span className="tabular-nums text-fg">{formatRuntime(Number(minutes))}</span>?</p>
                  <p className="mt-1 text-xl font-semibold">
                    <span className="tabular-nums">{count}</span> {count === 1 ? 'movie fits' : 'movies fit'}
                  </p>
                  <p className="mt-3 text-sm text-accent opacity-80 group-hover:opacity-100">Plan this →</p>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Recently added" action={<Link to="/watchlist" className="text-sm text-fg-2 hover:text-fg">See all</Link>}>
            {recent.isPending ? <PosterGridSkeleton /> : recent.error ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} /> : (
              <div className={movieGridClass}>{recent.data.data.map((i) => <MovieCard key={i.id} movie={i.movie} status={i.status} />)}</div>
            )}
          </Section>

          {(watched.data?.data.length ?? 0) > 0 && (
            <Section title="Recently watched">
              <div className={movieGridClass}>
                {/* One card per movie even if it was finished more than once. */}
                {[...new Map(watched.data!.data.map((ws) => [ws.movie.id, ws])).values()].map((ws) => <MovieCard key={ws.id} movie={ws.movie} />)}
              </div>
            </Section>
          )}

          {(insights.data?.insights.length ?? 0) > 0 && (
            <Section title="Your viewing">
              <ul className="grid gap-3 sm:grid-cols-3">
                {insights.data!.insights.map((i) => (
                  <li key={i.code} className="rounded-2xl border border-line bg-surface p-5 text-fg-2">{i.text}</li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4 sm:px-5">
      <dt className="text-xs text-fg-2 sm:text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
    </div>
  )
}
