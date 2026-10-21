import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { signedOut } from '../lib/query-client'
import type { User } from '../types/api'
import { ChevronIcon, LogoutIcon, SettingsIcon } from './icons'
import { useToast } from './toast'

/**
 * Avatar button + dropdown with the signed-in email, Settings and Sign out.
 * `compact` (mobile header) shows only the avatar and opens the menu to the left.
 */
export function AccountMenu({ user, compact = false }: { user: User; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const signOut = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      setOpen(false)
      navigate('/', { replace: true })
      signedOut(queryClient)
      toast('Signed out.')
    },
    onError: () => toast("Couldn't sign you out. Check your connection and try again.", 'error'),
  })

  // Close on outside click or Escape; return focus to the trigger on Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      rootRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const initial = user.email.trim()[0]?.toUpperCase() ?? '?'
  const avatar = (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-1 ring-accent/30">
      {initial}
    </span>
  )
  const itemClass = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm focus-visible:bg-elevated'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={compact ? `Account menu for ${user.email}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={compact
          ? 'rounded-full p-1 hover:bg-elevated'
          : `flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors ${open ? 'border-line bg-elevated' : 'border-transparent hover:bg-elevated/60'}`}
      >
        {avatar}
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg" title={user.email}>{user.email}</span>
              <span className="block text-xs text-muted">Account</span>
            </span>
            <ChevronIcon width={16} height={16} className={`shrink-0 text-muted transition-transform ${open ? '' : 'rotate-180'}`} />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className={`absolute z-50 animate-rise rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/50 ${
            compact ? 'right-0 top-full mt-2 w-64' : 'inset-x-0 bottom-full mb-2'
          }`}
        >
          <div className="px-3 pb-2 pt-2">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="truncate text-sm font-medium text-fg" title={user.email}>{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line/70" />
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={`${itemClass} text-fg-2 hover:bg-elevated hover:text-fg`}>
            <SettingsIcon width={17} height={17} /> Settings
          </Link>
          <div className="my-1 h-px bg-line/70" />
          <button
            role="menuitem"
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            className={`${itemClass} text-danger hover:bg-danger/10 disabled:opacity-60`}
          >
            <LogoutIcon width={17} height={17} /> {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
