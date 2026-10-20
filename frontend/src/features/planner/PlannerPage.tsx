import { useDeferredValue, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { CONTEXT_OPTIONS } from '../../lib/format'
import type { CompletionPreference, Mood, ViewingContext } from '../../types/api'
import { Button, ButtonLink, Chip, EmptyState, Skeleton } from '../../components/ui'
import { GenreSelector, MAX_MINUTES, MIN_MINUTES, MoodSelector, TIME_PRESETS, TimeSelector } from '../../components/planner-controls'
import { ClockIcon } from '../../components/icons'
import { useToast } from '../../components/toast'

const COMPLETION_OPTIONS: { value: CompletionPreference; label: string; hint: string }[] = [
  { value: 'single_sitting', label: 'Finish in one sitting', hint: 'Only movies that fit your time' },
  { value: 'open_to_longer', label: 'Open to longer movies', hint: 'Longer picks rank lower' },
  { value: 'continue_started', label: 'Continue something I started', hint: 'Paused or in-progress movies' },
]

/** Planner state lives in the URL so "Adjust my time" can come back to it. */
function useInitialState() {
  const [params] = useSearchParams()
  const minutes = Number(params.get('minutes')) || 90
  return {
    minutes,
    custom: !TIME_PRESETS.includes(minutes as (typeof TIME_PRESETS)[number]),
    mood: (params.get('mood') as Mood | null) ?? null,
    genreIds: params.get('genres')?.split(',').map(Number).filter(Boolean) ?? [],
    context: (params.get('context') as ViewingContext | null) ?? null,
    completion: (params.get('completion') as CompletionPreference | null) ?? 'single_sitting',
  }
}

export function PlannerPage() {
  const initial = useInitialState()
  const [minutes, setMinutes] = useState(initial.minutes)
  const [custom, setCustom] = useState(initial.custom)
  const [mood, setMood] = useState<Mood | null>(initial.mood)
  const [genreIds, setGenreIds] = useState<number[]>(initial.genreIds)
  const [context, setContext] = useState<ViewingContext | null>(initial.context)
  const [completion, setCompletion] = useState<CompletionPreference>(initial.completion)
  const [showMore, setShowMore] = useState(Boolean(initial.mood || initial.genreIds.length || initial.context))
  const navigate = useNavigate()
  const toast = useToast()

  const validMinutes = Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES
  const deferredMinutes = useDeferredValue(minutes)

  const summary = useQuery({ queryKey: ['watchlist-summary'], queryFn: api.watchlistSummary })
  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })
  const preview = useQuery({
    queryKey: ['preview', deferredMinutes, completion],
    queryFn: () => api.previewCount({ available_minutes: deferredMinutes, completion_preference: completion }),
    enabled: validMinutes && (summary.data?.total ?? 0) > 0,
    placeholderData: (prev) => prev,
  })

  const recommend = useMutation({
    mutationFn: api.recommend,
    onSuccess: (session) => navigate(`/plan/results/${session.id}`),
    onError: (e) => toast(e.message, 'error'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!validMinutes) return
    recommend.mutate({
      available_minutes: minutes,
      mood: mood ?? undefined,
      genre_ids: genreIds,
      viewing_context: context ?? undefined,
      completion_preference: completion,
    })
  }

  if (summary.isPending) return <Skeleton className="h-96 w-full" />
  if (summary.data?.total === 0) {
    return (
      <EmptyState icon={<ClockIcon width={32} height={32} />} title="Nothing on your watchlist yet." description="Save a few movies you'd love to watch. We'll help you choose when the time comes.">
        <ButtonLink to="/discover">Discover movies</ButtonLink>
      </EmptyState>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">How much time have you got?</h1>
        <p className="mt-3 text-lg text-fg-2">Choose your window. We'll handle the shortlist.</p>
      </header>

      <TimeSelector value={minutes} custom={custom} onChange={(m, c) => { setMinutes(m); setCustom(c) }} />
      {!validMinutes && <p role="alert" className="mt-2 text-sm text-danger">Pick between {MIN_MINUTES} and {MAX_MINUTES} minutes.</p>}

      <PlannerBlock title="Want to finish in one sitting?">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Completion preference">
          {COMPLETION_OPTIONS.map((o) => (
            <label key={o.value} className="relative">
              <input type="radio" name="completion" className="peer sr-only" checked={completion === o.value} onChange={() => setCompletion(o.value)} />
              <span className={`block h-full cursor-pointer rounded-2xl border p-4 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                completion === o.value ? 'border-accent/60 bg-accent/10' : 'border-line bg-card hover:border-fg-2/40'
              }`}>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border ${completion === o.value ? 'border-accent' : 'border-muted'}`}>
                    {completion === o.value && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  {o.label}
                </span>
                <span className="mt-1 block pl-6 text-xs text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </PlannerBlock>

      {!showMore ? (
        <button type="button" onClick={() => setShowMore(true)} className="mt-8 text-sm font-medium text-fg-2 underline-offset-4 hover:text-fg hover:underline">
          + Add mood, genres or company (optional)
        </button>
      ) : (
        <div className="animate-rise">
          <PlannerBlock title="What's the mood?" optional>
            <MoodSelector value={mood} onChange={setMood} />
          </PlannerBlock>
          <PlannerBlock title="What do you feel like watching?" optional>
            {genres.data ? <GenreSelector genres={genres.data} value={genreIds} onChange={setGenreIds} /> : <Skeleton className="h-20" />}
          </PlannerBlock>
          <PlannerBlock title="Who's watching?" optional hint="Saved with your session. It doesn't change the ranking yet.">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Who's watching">
              {CONTEXT_OPTIONS.map((c) => (
                <Chip key={c.value} selected={context === c.value} onClick={() => setContext(context === c.value ? null : c.value)}>{c.label}</Chip>
              ))}
            </div>
          </PlannerBlock>
        </div>
      )}

      <div className="sticky bottom-20 z-10 mt-10 flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-6">
        <p className="text-sm text-fg-2" aria-live="polite">
          {preview.data === undefined ? 'Just a few good options. No endless scrolling.' : <PreviewText count={preview.data} minutes={deferredMinutes} completion={completion} />}
        </p>
        <Button type="submit" size="lg" disabled={!validMinutes || recommend.isPending}>
          {recommend.isPending ? 'Finding…' : 'Find my movie'}
        </Button>
      </div>
    </form>
  )
}

function PreviewText({ count, minutes, completion }: { count: number; minutes: number; completion: CompletionPreference }) {
  const strong = <span className="font-semibold tabular-nums text-fg">{count}</span>
  if (completion === 'open_to_longer') return <>{strong} {count === 1 ? 'movie' : 'movies'} on your watchlist to choose from.</>
  if (completion === 'continue_started') return <>{strong} started {count === 1 ? 'movie fits' : 'movies fit'} the time you have left.</>
  if (count === 0) return <>Nothing fits {minutes} minutes yet. Try a little more time.</>
  return <>{strong} {count === 1 ? 'movie fits' : 'movies fit'} in {minutes} minutes.</>
}

function PlannerBlock({ title, optional, hint, children }: { title: string; optional?: boolean; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-base font-semibold">
        {title} {optional && <span className="ml-1 text-xs font-normal text-muted">Optional</span>}
      </h2>
      {children}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </section>
  )
}
