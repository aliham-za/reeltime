import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Movie } from '../../types/api'
import { Button, EmptyState, ErrorState, inputClass, PageHeader, PosterGridSkeleton } from '../../components/ui'
import { MovieCard, movieGridClass } from '../../components/movies'
import { CheckIcon, PlusIcon, SearchIcon } from '../../components/icons'
import { useWatchlistActions } from '../watchlist/useWatchlistActions'

export function DiscoverPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1
  const [draft, setDraft] = useState(q)

  const results = useQuery({
    queryKey: ['movies', q ? 'search' : 'popular', q, page],
    queryFn: () => (q ? api.searchMovies(q, page) : api.popularMovies(page)),
    placeholderData: (prev) => prev,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = draft.trim()
    setParams(next ? { q: next } : {})
  }
  const meta = results.data?.meta

  return (
    <div>
      <PageHeader title="Discover movies" description="Save the ones you'd genuinely like to watch. ReelTime will help you pick when the time comes." />

      <form onSubmit={submit} role="search" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="discover-q" className="sr-only">Search by title</label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
          <input id="discover-q" type="search" maxLength={100} placeholder="Search by title" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} h-11 pl-10`} />
        </div>
        <Button type="submit" size="lg" className="h-11">Search</Button>
      </form>

      {meta?.source === 'local' && (
        <p className="mb-6 rounded-xl border border-violet/30 bg-violet/8 px-4 py-3 text-sm text-fg-2">
          {meta.notice ?? "You're browsing ReelTime's built-in sample catalog of fictional movies. Add a TMDB API token on the server to search real movies."}
        </p>
      )}

      <h2 className="mb-4 text-lg font-semibold">{q ? `Results for “${q}”` : 'Popular right now'}</h2>

      {results.isPending ? (
        <PosterGridSkeleton count={12} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : results.data.data.length === 0 ? (
        <EmptyState title="No movies found." description={`We couldn't find anything matching “${q}”. Check the spelling or try another title.`} />
      ) : (
        <>
          <div className={`${movieGridClass} ${results.isPlaceholderData ? 'opacity-60' : ''}`}>
            {results.data.data.map((m) => <DiscoverCard key={m.id ?? `tmdb-${m.tmdb_id}`} movie={m} />)}
          </div>
          {meta && meta.total_pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page <= 1}
                onClick={() => setParams({ ...(q && { q }), page: String(page - 1) })}>Previous</button>
              <span className="tabular-nums text-muted">Page {page} of {meta.total_pages}</span>
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page >= meta.total_pages}
                onClick={() => setParams({ ...(q && { q }), page: String(page + 1) })}>Next</button>
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
