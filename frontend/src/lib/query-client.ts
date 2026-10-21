import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  // A 401 from any query means the session ended (signed out elsewhere, expired, redeployed).
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(['me'], null)
    },
  }),
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

/** Drops every cached user-specific query and shows the sign-in screen (AuthGate reads `me === null`). */
export function signedOut(client: QueryClient) {
  client.setQueryData(['me'], null)
  client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
}
