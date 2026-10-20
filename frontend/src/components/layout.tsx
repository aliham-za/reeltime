import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryClient } from '../lib/query-client'
import type { User } from '../types/api'
import { ClockIcon, HistoryIcon, HomeIcon, ListIcon, LogoutIcon, SearchIcon, SettingsIcon } from './icons'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/plan', label: 'Find a movie', short: 'Plan', icon: ClockIcon },
  { to: '/watchlist', label: 'Watchlist', icon: ListIcon },
  { to: '/discover', label: 'Discover', icon: SearchIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink"><ClockIcon width={16} height={16} strokeWidth={2.4} /></span>
      ReelTime
    </span>
  )
}

export function AppLayout({ user }: { user: User }) {
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => queryClient.clear(),
  })

  return (
    <div className="min-h-dvh md:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line/70 bg-surface px-4 py-6 md:flex">
        <Link to="/" aria-label="ReelTime home" className="self-start rounded-lg px-2"><Logo /></Link>
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-elevated text-fg font-medium' : 'text-fg-2 hover:bg-elevated/60 hover:text-fg'}`
              }
            >
              {({ isActive }) => (<><Icon className={isActive ? 'text-accent' : ''} />{label}</>)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <div className="flex items-center justify-between gap-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted" title={user.email}>{user.email}</span>
            <NavLink to="/settings" className={({ isActive }) => `rounded-lg p-1.5 hover:bg-elevated hover:text-fg ${isActive ? 'text-accent' : 'text-muted'}`} aria-label="Settings">
              <SettingsIcon width={18} height={18} />
            </NavLink>
            <button type="button" onClick={() => logout.mutate()} className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg" aria-label="Sign out">
              <LogoutIcon width={18} height={18} />
            </button>
          </div>
          <TmdbAttribution />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" aria-label="ReelTime home" className="rounded-lg"><Logo /></Link>
        <div className="flex items-center">
          <NavLink to="/settings" className={({ isActive }) => `rounded-lg p-2 hover:text-fg ${isActive ? 'text-accent' : 'text-muted'}`} aria-label="Settings">
            <SettingsIcon width={20} height={20} />
          </NavLink>
          <button type="button" onClick={() => logout.mutate()} className="rounded-lg p-2 text-muted hover:text-fg" aria-label="Sign out">
            <LogoutIcon width={18} height={18} />
          </button>
        </div>
      </header>

      <ScrollRestoration />
      <main id="main" className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10">
        <Outlet />
        <div className="mt-16 md:hidden"><TmdbAttribution /></div>
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, label, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-accent' : 'text-fg-2'}`}>
            <Icon />
            {short ?? label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function TmdbAttribution() {
  return (
    <p className="text-[11px] leading-snug text-muted">
      Movie data from <a className="underline hover:text-fg-2" href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  )
}
