import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { STATUS_LABELS } from '../../lib/format'
import { WATCH_STATUSES, type WatchlistItem, type WatchStatus } from '../../types/api'
import { ButtonLink, Chip, EmptyState, ErrorState, inputClass, PageHeader, PosterGridSkeleton } from '../../components/ui'
import { MovieCard, movieGridClass } from '../../components/movies'
import { ConfirmDialog } from '../../components/dialog'
import { CloseIcon, ListIcon, StarIcon } from '../../components/icons'
import { useWatchlistActions } from './useWatchlistActions'

const SORTS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'runtime', label: 'Runtime' },
  { value: 'priority', label: 'Priority first' },
]
const PER_PAGE = 48

export function WatchlistPage() {
  const [status, setStatus] = useState<WatchStatus | ''>('')
  const [genreId, setGenreId] = useState<number | ''>('')
  const [sort, setSort] = useState('recent')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [removing, setRemoving] = useState<WatchlistItem | null>(null)
  const query = useDeferredValue(q.trim())
  const { update, remove } = useWatchlistActions()

  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: Infinity })
  const list = useQuery({
    queryKey: ['watchlist', { status, genreId, sort, query, page }],
    queryFn: () => api.watchlist({ status: status || undefined, genre_id: genreId || undefined, sort, q: query || undefined, page, per_page: PER_PAGE }),
    placeholderData: (prev) => prev,
  })
  const filtered = Boolean(status || genreId || query)
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1) }

  return (
    <div>
      <PageHeader
        title="Your watchlist"
        description={list.data ? `${list.data.meta.total} ${list.data.meta.total === 1 ? 'movie' : 'movies'}${filtered ? ' match' : ' saved'}` : 'Everything you want to watch, in one place.'}
        actions={<><ButtonLink to="/plan">Find my movie</ButtonLink><ButtonLink to="/discover" variant="secondary">Add movies</ButtonLink></>}
      />

      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="wl-search">Search your watchlist</label>
          <input id="wl-search" type="search" placeholder="Search your watchlist" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className={`${inputClass} sm:max-w-xs`} />
          <label className="sr-only" htmlFor="wl-genre">Genre</label>
          <select id="wl-genre" value={genreId} onChange={(e) => resetPage(setGenreId)(e.target.value ? Number(e.target.value) : '')} className={`${inputClass} sm:w-44`}>
            <option value="">All genres</option>
            {genres.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="wl-sort">Sort by</label>
          <select id="wl-sort" value={sort} onChange={(e) => resetPage(setSort)(e.target.value)} className={`${inputClass} sm:w-44`}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <Chip selected={status === ''} onClick={() => resetPage(setStatus)('')}>All</Chip>
          {WATCH_STATUSES.map((s) => <Chip key={s} selected={status === s} onClick={() => resetPage(setStatus)(s)}>{STATUS_LABELS[s]}</Chip>)}
        </div>
      </div>

      {list.isPending ? (
        <PosterGridSkeleton count={12} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.data.length === 0 ? (
        filtered ? (
          <EmptyState title="No movies match these filters." description="Try a different status or genre." />
        ) : (
          <EmptyState icon={<ListIcon width={32} height={32} />} title="Your watchlist is waiting for its first movie." description="Add a few movies you'd love to watch. We'll help you find the right one when the time comes.">
            <ButtonLink to="/discover">Discover movies</ButtonLink>
          </EmptyState>
        )
      ) : (
        <>
          <div className={`${movieGridClass} ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            {list.data.data.map((item) => (
              <MovieCard
                key={item.id}
                movie={item.movie}
                actions={
                  <>
                    <button
                      type="button"
                      aria-pressed={item.priority}
                      aria-label={item.priority ? `Remove priority from ${item.movie.title}` : `Mark ${item.movie.title} as a priority`}
                      onClick={() => update.mutate({ id: item.id, priority: !item.priority })}
                      className={`grid h-8 w-8 place-items-center rounded-lg border border-line bg-canvas/85 backdrop-blur ${item.priority ? 'text-accent' : 'text-fg-2 hover:text-fg'}`}
                    >
                      <StarIcon filled={item.priority} width={15} height={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.movie.title} from watchlist`}
                      onClick={() => setRemoving(item)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-canvas/85 text-fg-2 backdrop-blur hover:text-danger"
                    >
                      <CloseIcon width={15} height={15} />
                    </button>
                  </>
                }
                footer={
                  <>
                    <label className="sr-only" htmlFor={`status-${item.id}`}>Status for {item.movie.title}</label>
                    <select
                      id={`status-${item.id}`}
                      value={item.status}
                      onChange={(e) => update.mutate({ id: item.id, status: e.target.value as WatchStatus })}
                      className="h-8 w-full rounded-lg border border-line bg-card px-2 text-xs text-fg-2"
                    >
                      {WATCH_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </>
                }
              />
            ))}
          </div>
          {list.data.meta.total_pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="tabular-nums text-muted">Page {page} of {list.data.meta.total_pages}</span>
              <button type="button" className="rounded-lg px-3 py-1.5 text-fg-2 hover:bg-elevated disabled:opacity-40" disabled={page >= list.data.meta.total_pages} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove from watchlist?"
        message={`${removing?.movie.title ?? 'This movie'} will be removed. Your past viewing history stays.`}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove.mutate(removing.id); setRemoving(null) }}
      />
    </div>
  )
}
