import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { providerLogoUrl } from '../../lib/format'
import type { User } from '../../types/api'
import { Button, ErrorState, Field, inputClass, PageHeader, Skeleton } from '../../components/ui'
import { useToast } from '../../components/toast'

const SHOWN_SERVICES = 30

export function SettingsPage() {
  const me = useQuery<User>({ queryKey: ['me'], queryFn: api.me, staleTime: Infinity })
  if (!me.data) return <Skeleton className="h-96 w-full max-w-2xl" />
  return <SettingsForm user={me.data} />
}

function SettingsForm({ user }: { user: User }) {
  const [country, setCountry] = useState(user.country)
  const [services, setServices] = useState<number[]>(user.subscribed_provider_ids)
  const [filter, setFilter] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  const regions = useQuery({ queryKey: ['regions'], queryFn: api.regions, staleTime: Infinity })
  const providers = useQuery({ queryKey: ['providers', country], queryFn: () => api.providers(country), staleTime: 60 * 60_000 })

  // Your services first, then TMDB's popularity order for the country, narrowed by the search box.
  const visible = useMemo(() => {
    const list = providers.data ?? []
    const q = filter.trim().toLowerCase()
    if (q) return list.filter((p) => p.name.toLowerCase().includes(q))
    const mine = list.filter((p) => services.includes(p.id))
    return [...mine, ...list.filter((p) => !services.includes(p.id)).slice(0, SHOWN_SERVICES)]
  }, [providers.data, filter, services])

  const save = useMutation({
    mutationFn: () => api.updateMe({ country, subscribed_provider_ids: services }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated)
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['preview'] })
      toast('Settings saved.')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const dirty = country !== user.country || services.join() !== user.subscribed_provider_ids.join()
  const toggle = (id: number) => setServices((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="max-w-3xl">
      <PageHeader title="Settings" description="Tell ReelTime where you watch, so it can show what's free or on your services." />

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Where you watch</h2>
        <p className="mt-1 text-sm text-fg-2">Streaming availability is different in every country.</p>
        <div className="mt-4 max-w-xs">
          <Field label="Country" htmlFor="country">
            {regions.error ? (
              <ErrorState error={regions.error} onRetry={() => regions.refetch()} />
            ) : (
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} disabled={!regions.data}>
                {!regions.data && <option value={country}>{country}</option>}
                {regions.data?.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            )}
          </Field>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Your services</h2>
          <span className="text-sm text-fg-2" aria-live="polite">{services.length} selected</span>
        </div>
        <p className="mt-1 text-sm text-fg-2">Pick the subscriptions you have. "Free or my services" in the planner uses these.</p>
        <label htmlFor="service-search" className="sr-only">Search services</label>
        <input id="service-search" type="search" placeholder="Search services" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} mt-4 max-w-xs`} />

        {providers.isPending ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : providers.error ? (
          <div className="mt-4"><ErrorState error={providers.error} onRetry={() => providers.refetch()} /></div>
        ) : visible.length === 0 ? (
          <p className="mt-4 text-sm text-fg-2">No services match “{filter}”.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Services">
            {visible.map((p) => {
              const selected = services.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-3 rounded-xl border p-2 pr-3 text-left text-sm transition-colors ${
                    selected ? 'border-accent/60 bg-accent/10 text-fg' : 'border-line bg-card text-fg-2 hover:border-fg-2/40 hover:text-fg'
                  }`}
                >
                  {providerLogoUrl(p.logo_path)
                    ? <img src={providerLogoUrl(p.logo_path)!} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-lg" />
                    : <span className="h-9 w-9 shrink-0 rounded-lg bg-elevated" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span aria-hidden className={selected ? 'text-accent' : 'text-transparent'}>✓</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Service list and availability data by <a href="https://www.justwatch.com" target="_blank" rel="noreferrer" className="underline hover:text-fg-2">JustWatch</a>.</p>
      </section>

      <div className="sticky bottom-20 z-10 mt-6 flex items-center justify-end gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-6">
        {dirty && <span className="text-sm text-fg-2">Unsaved changes</span>}
        <Button type="submit" size="lg" disabled={!dirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
      </div>
    </form>
  )
}
