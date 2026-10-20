import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { providerLogoUrl } from '../lib/format'
import { AVAILABILITY_GROUPS } from '../types/api'
import { ExternalIcon } from './icons'
import { Skeleton } from './ui'

const GROUP_LABELS = { free: 'Free', subscription: 'Subscription', rent: 'Rent', buy: 'Buy' } as const

/** Legal streaming options in the user's country (TMDB watch providers, data by JustWatch). */
export function WhereToWatch({ movieId }: { movieId: number }) {
  const availability = useQuery({ queryKey: ['availability', movieId], queryFn: () => api.availability(movieId), staleTime: 5 * 60_000 })

  return (
    <section aria-labelledby="where-to-watch" className="mt-10">
      <h2 id="where-to-watch" className="mb-3 text-base font-semibold">Where to watch</h2>
      {availability.isPending ? (
        <Skeleton className="h-16 w-full max-w-md" />
      ) : availability.error ? (
        <p className="text-sm text-fg-2">Streaming info isn't available right now.</p>
      ) : (
        <>
          {AVAILABILITY_GROUPS.every((g) => availability.data.groups[g].length === 0) ? (
            <p className="text-sm text-fg-2">
              Not streaming in {availability.data.region} right now.{' '}
              <Link to="/settings" className="text-accent hover:underline">Change country</Link>
            </p>
          ) : (
            <dl className="space-y-3">
              {AVAILABILITY_GROUPS.filter((g) => availability.data.groups[g].length > 0).map((group) => (
                <div key={group} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <dt className={`w-24 text-sm ${group === 'free' ? 'font-medium text-success' : 'text-fg-2'}`}>{GROUP_LABELS[group]}</dt>
                  <dd className="flex flex-wrap gap-2">
                    {availability.data.groups[group].map((p) => (
                      <a
                        key={p.id}
                        href={availability.data.link ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        title={p.subscribed ? `${p.name} (you have this)` : p.name}
                        className={`relative block rounded-xl ${p.subscribed ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : ''}`}
                      >
                        {providerLogoUrl(p.logo_path) ? (
                          <img src={providerLogoUrl(p.logo_path)!} alt={p.name} width={40} height={40} loading="lazy" className="h-10 w-10 rounded-xl" />
                        ) : (
                          <span className="grid h-10 min-w-10 place-items-center rounded-xl bg-elevated px-2 text-xs">{p.name}</span>
                        )}
                        {p.subscribed && <span className="sr-only"> (you have this)</span>}
                      </a>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Availability in {availability.data.region} · data by <a href="https://www.justwatch.com" target="_blank" rel="noreferrer" className="underline hover:text-fg-2">JustWatch</a></span>
            {availability.data.link && (
              <a href={availability.data.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
                All options <ExternalIcon width={12} height={12} />
              </a>
            )}
          </p>
        </>
      )}
    </section>
  )
}
