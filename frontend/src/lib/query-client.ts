import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (auth, validation, not found).
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

// Anything that changes what's on the watchlist or in history touches these.
export const invalidateLibrary = () =>
  Promise.all(
    [['watchlist'], ['watchlist-summary'], ['watch-sessions'], ['insights'], ['movie'], ['movies']].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  )
