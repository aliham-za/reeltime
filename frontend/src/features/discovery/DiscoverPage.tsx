import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatRuntime } from '../../lib/format'
import type { Movie } from '../../types/api'
import { Button, Chip, EmptyState, ErrorState, inputClass, PageHeader, PosterGridSkeleton } from '../../components/ui'
import { MovieCard, movieGridClass } from '../../components/movies'
import { CheckIcon, PlusIcon, SearchIcon } from '../../components/icons'
import { useWatchlistActions } from '../watchlist/useWatchlistActions'

const RUNTIME_OPTIONS = [60, 90, 120, 150]
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: THIS_YEAR + 1 - 1920 + 1 }, (_, i) => THIS_YEAR + 1 - i)
const FILTER_KEYS = ['genre', 'year', 'runtime', 'free'] as const
const filterSelectClass = `${inputClass.replace('w-full', '')} flex-1 sm:flex-none sm:w-44`

export function DiscoverPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1
  const genre = Number(params.get('genre')) || undefined
  const year = Number(params.get('year')) || undefined
  const runtime = Number(params.get('runtime')) || undefined
  const free = params.get('free') === '1'
  const filtered = Boolean(genre || year || runtime || free)
  const [draft, setDraft] = useState(q)

  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })
  const results = useQuery({
    queryKey: ['movies', q ? 'search' : filtered ? 'discover' : 'popular', q, genre, year, runtime, free, page],
    queryFn: () =>
      q ? api.searchMovies(q, page)
        : filtered ? api.discoverMovies({ genre_id: genre, year, max_runtime: runtime, free: free || undefined }, page)
          : api.popularMovies(page),
    placeholderData: (prev) => prev,
  })

  /** Updates the URL; any change other than paging goes back to page 1. */
  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update({ q: draft.trim() || undefined })
  }
  const meta = results.data?.meta
  const genreName = genres.data?.find((g) => g.id === genre)?.name
  const heading = q
    ? `Results for “${q}”`
    : filtered
      ? [free ? `Free ${genreName ?? 'movies'}` : genreName ?? 'Movies', year && `from ${year}`, runtime && `under ${formatRuntime(runtime)}`].filter(Boolean).join(' ')
      : 'Popular right now'

  return (
    <div>
      <PageHeader title="Discover movies" description="Save the ones you'd genuinely like to watch. ReelTime will help you pick when the time comes." />

      <form onSubmit={submit} role="search" className="mb-4 flex max-w-xl gap-2">
        <label htmlFor="discover-q" className="sr-only">Search by title</label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
          <input id="discover-q" type="search" maxLength={100} placeholder="Search by title" value={draft}
            onChange={(e) => { setDraft(e.target.value); if (!e.target.value && q) update({ q: undefined }) }}
            className={`${inputClass} h-11 pl-10`} />
        </div>
        <Button type="submit" size="lg" className="h-11">Search</Button>
      </form>

      {q ? (
        <p className="mb-6 text-sm text-fg-2">
          Filters apply when browsing.{' '}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setDraft(''); update({ q: undefined }) }}>Clear search</button>
        </p>
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <label className="sr-only" htmlFor="filter-genre">Genre</label>
          <select id="filter-genre" value={genre ?? ''} onChange={(e) => update({ genre: e.target.value })} className={filterSelectClass}>
            <option value="">Any genre</option>
            {genres.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="filter-year">Release year</label>
          <select id="filter-year" value={year ?? ''} onChange={(e) => update({ year: e.target.value })} className={filterSelectClass}>
            <option value="">Any year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="sr-only" htmlFor="filter-runtime">Maximum runtime</label>
          <select id="filter-runtime" value={runtime ?? ''} onChange={(e) => update({ runtime: e.target.value })} className={filterSelectClass}>
            <option value="">Any length</option>
            {RUNTIME_OPTIONS.map((m) => <option key={m} value={m}>Under {formatRuntime(m)}</option>)}
          </select>
          <Chip selected={free} onClick={() => update({ free: free ? undefined : 1 })}>Free to watch</Chip>
          {filtered && (
            <button type="button" className="px-2 text-sm font-medium text-fg-2 hover:text-fg"
              onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {meta?.source === 'local' && (
        <p className="mb-6 rounded-xl border border-violet/30 bg-violet/8 px-4 py-3 text-sm text-fg-2">
          {meta.notice ?? "You're browsing ReelTime's built-in sample catalog of fictional movies. Add a TMDB API token on the server to search real movies."}
        </p>
      )}

      <h2 className="mb-4 text-lg font-semibold" aria-live="polite">{heading}</h2>

      {results.isPending ? (
        <PosterGridSkeleton count={12} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : results.data.data.length === 0 ? (
        q ? (
          <EmptyState title="No movies found." description={`We couldn't find anything matching “${q}”. Check the spelling or try another title.`} />
        ) : (
          <EmptyState title="No movies match these filters." description="Try a different year or a longer runtime.">
            <Button variant="secondary" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}>Clear filters</Button>
          </EmptyState>
        )
      ) : (
        <>
          <div className={`${movieGridClass} ${results.isPlaceholderData ? 'opacity-60' : ''}`}>
            {results.data.data.map((m) => <DiscoverCard key={m.id ?? `tmdb-${m.tmdb_id}`} movie={m} />)}
          </div>
          {meta && meta.total_pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page <= 1}
                onClick={() => update({ page: page - 1 })}>Previous</button>
              <span className="tabular-nums text-muted">Page {page} of {meta.total_pages}</span>
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page >= meta.total_pages}
                onClick={() => update({ page: page + 1 })}>Next</button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

function DiscoverCard({ movie }: { movie: Movie }) {
  const { add } = useWatchlistActions()
  const saved = Boolean(movie.watchlist_item_id) || (add.isSuccess && add.variables?.tmdb_id === movie.tmdb_id && add.variables?.id === movie.id)
  return (
    <MovieCard
      movie={movie}
      footer={
        saved ? (
          <span className="inline-flex h-8 items-center gap-1.5 text-sm text-success"><CheckIcon width={16} height={16} /> On your watchlist</span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => add.mutate(movie)} disabled={add.isPending} aria-label={`Add ${movie.title} to watchlist`}>
            <PlusIcon width={16} height={16} /> {add.isPending ? 'Adding…' : 'Watchlist'}
          </Button>
        )
      }
    />
  )
}
