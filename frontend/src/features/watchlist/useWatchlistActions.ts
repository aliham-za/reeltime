import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { invalidateLibrary } from '../../lib/query-client'
import { useToast } from '../../components/toast'
import type { Movie, WatchlistItem } from '../../types/api'

/** Watchlist mutations with consistent invalidation and feedback, shared by every page. */
export function useWatchlistActions() {
  const toast = useToast()
  const onError = (e: Error) => toast(e.message, 'error')

  const add = useMutation({
    mutationFn: (movie: Pick<Movie, 'id' | 'tmdb_id'>) => api.addToWatchlist(movie),
    onSuccess: async () => { await invalidateLibrary(); toast('Added to your watchlist.') },
    onError,
  })
  const update = useMutation({
    mutationFn: ({ id, ...changes }: { id: number } & Parameters<typeof api.updateWatchlistItem>[1]) => api.updateWatchlistItem(id, changes),
    onSuccess: async (item: WatchlistItem, vars) => {
      await invalidateLibrary()
      if (vars.status === 'watched') toast('Marked as watched.')
      else if (vars.status) toast('Status updated.')
      else toast(vars.priority !== undefined ? (item.priority ? 'Marked as a priority.' : 'Priority removed.') : 'Saved.')
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.removeFromWatchlist(id),
    onSuccess: async () => { await invalidateLibrary(); toast('Removed from your watchlist.') },
    onError,
  })
  return { add, update, remove }
}
