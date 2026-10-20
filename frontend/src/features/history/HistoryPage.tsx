import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { invalidateLibrary } from '../../lib/query-client'
import { formatDate, OUTCOME_LABELS } from '../../lib/format'
import { OUTCOMES, type Outcome, type WatchSession } from '../../types/api'
import { ButtonLink, Chip, EmptyState, ErrorState, PageHeader, Section, Skeleton } from '../../components/ui'
import { movieHref, Poster } from '../../components/movies'
import { HistoryIcon } from '../../components/icons'
import { useToast } from '../../components/toast'
import { CompletionDialog } from './CompletionDialog'
import { NowWatchingCard } from './NowWatchingCard'

const FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Finished', value: 'completed' },
  { label: 'Paused', value: 'paused,interrupted' },
  { label: 'Stopped', value: 'abandoned' },
]

export function HistoryPage() {
  const [filter, setFilter] = useState('')
  const [reporting, setReporting] = useState<WatchSession | null>(null)
  const open = useQuery({ queryKey: ['watch-sessions', 'open'], queryFn: () => api.watchSessions({ outcome: 'in_progress' }) })
  const past = useQuery({
    queryKey: ['watch-sessions', 'past', filter],
    queryFn: () => api.watchSessions({ outcome: filter || 'completed,paused,interrupted,abandoned', per_page: 50 }),
  })

  const nothingYet = open.data?.data.length === 0 && past.data?.data.length === 0 && !filter

  return (
    <div>
      <PageHeader title="Viewing history" description="Every attempt is kept, so a movie you stopped once can still be finished later." />
      <CompletionDialog session={reporting} onClose={() => setReporting(null)} />

      {nothingYet ? (
        <EmptyState icon={<HistoryIcon width={32} height={32} />} title="Your viewing history starts here." description="Once you start watching, your recent movies will show up here.">
          <ButtonLink to="/plan">Find my movie</ButtonLink>
        </EmptyState>
      ) : (
        <>
          {(open.data?.data.length ?? 0) > 0 && (
            <section aria-labelledby="now-watching" className="mb-10">
              <h2 id="now-watching" className="mb-4 text-lg font-semibold">Watching now</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {open.data!.data.map((s) => <NowWatchingCard key={s.id} session={s} onReport={setReporting} />)}
              </div>
            </section>
          )}

          <Section title="Past attempts">
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by outcome">
              {FILTERS.map((f) => <Chip key={f.label} selected={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>)}
            </div>
            {past.isPending ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : past.error ? (
              <ErrorState error={past.error} onRetry={() => past.refetch()} />
            ) : past.data.data.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-fg-2">Nothing here yet.</p>
            ) : (
              <ul className="divide-y divide-line/70 rounded-2xl border border-line bg-surface">
                {past.data.data.map((s) => <HistoryRow key={s.id} session={s} />)}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

const OUTCOME_TONE: Record<Outcome, string> = {
  in_progress: 'text-accent',
  completed: 'text-success',
  paused: 'text-violet',
  interrupted: 'text-violet',
  abandoned: 'text-muted',
}

/** One attempt. The outcome select lets users fix a record they got wrong. */
function HistoryRow({ session }: { session: WatchSession }) {
  const toast = useToast()
  const correct = useMutation({
    mutationFn: (outcome: Outcome) => api.updateWatchSession(session.id, { outcome }),
    onSuccess: async () => { await invalidateLibrary(); toast('Updated.') },
    onError: (e) => toast(e.message, 'error'),
  })
  return (
    <li className="flex items-center gap-4 p-3 sm:p-4">
      <Link to={movieHref(session.movie)} className="w-12 shrink-0"><Poster movie={session.movie} /></Link>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{session.movie.title}</p>
        <p className="text-sm text-fg-2">
          {formatDate(session.ended_at ?? session.started_at)}
          {session.minutes_watched != null && session.outcome !== 'completed' && <> · <span className="tabular-nums">{session.minutes_watched} min watched</span></>}
        </p>
        {session.personal_feedback && <p className="mt-1 line-clamp-1 text-sm italic text-muted">“{session.personal_feedback}”</p>}
      </div>
      <label className="sr-only" htmlFor={`outcome-${session.id}`}>Outcome for {session.movie.title}</label>
      <select
        id={`outcome-${session.id}`}
        value={session.outcome}
        onChange={(e) => correct.mutate(e.target.value as Outcome)}
        disabled={correct.isPending}
        className={`h-9 rounded-lg border border-line bg-card px-2 text-sm font-medium ${OUTCOME_TONE[session.outcome]}`}
      >
        {OUTCOMES.filter((o) => o !== 'in_progress').map((o) => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
      </select>
    </li>
  )
}
