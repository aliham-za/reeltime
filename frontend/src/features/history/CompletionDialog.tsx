import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { invalidateLibrary } from '../../lib/query-client'
import type { Outcome, WatchSession } from '../../types/api'
import { Dialog } from '../../components/dialog'
import { Button, inputClass } from '../../components/ui'
import { useToast } from '../../components/toast'

const CHOICES: { outcome: Outcome; label: string; asksMinutes: boolean }[] = [
  { outcome: 'completed', label: 'Finished it', asksMinutes: false },
  { outcome: 'interrupted', label: 'Watched part of it', asksMinutes: true },
  { outcome: 'paused', label: 'Paused for later', asksMinutes: true },
  { outcome: 'abandoned', label: 'Stopped watching', asksMinutes: false },
]

/** "How did it go?" Records the outcome; rating and thoughts are optional. */
export function CompletionDialog({ session, onClose }: { session: WatchSession | null; onClose: () => void }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [minutes, setMinutes] = useState('')
  const [rating, setRating] = useState('')
  const [feedback, setFeedback] = useState('')
  const toast = useToast()

  const close = () => { setOutcome(null); setMinutes(''); setRating(''); setFeedback(''); onClose() }

  const save = useMutation({
    mutationFn: async () => {
      if (!session || !outcome) return
      await api.updateWatchSession(session.id, {
        outcome,
        minutes_watched: minutes ? Number(minutes) : outcome === 'completed' ? session.movie.runtime_minutes : null,
        personal_feedback: feedback.trim() || null,
      })
      if (rating && session.watchlist_item_id) await api.updateWatchlistItem(session.watchlist_item_id, { personal_rating: Number(rating) })
    },
    onSuccess: async () => {
      await invalidateLibrary()
      toast(outcome === 'completed' ? 'Marked as watched.' : outcome === 'paused' ? 'Saved. Pick it up any time.' : 'Got it, saved.')
      close()
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const choice = CHOICES.find((c) => c.outcome === outcome)

  return (
    <Dialog open={session !== null} onClose={close} title="How did it go?">
      {session && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
          <p className="-mt-2 mb-4 text-sm text-fg-2">{session.movie.title}</p>
          <fieldset>
            <legend className="sr-only">Outcome</legend>
            <div className="grid grid-cols-2 gap-2">
              {CHOICES.map((c) => (
                <label key={c.outcome} className="relative">
                  <input type="radio" name="outcome" className="peer sr-only" checked={outcome === c.outcome} onChange={() => setOutcome(c.outcome)} />
                  <span className={`flex h-14 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
                    outcome === c.outcome ? 'border-accent bg-accent/12 text-fg' : 'border-line bg-card text-fg-2 hover:text-fg'
                  }`}>
                    {outcome === c.outcome && <span aria-hidden className="mr-1.5 text-accent">✓</span>}{c.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {choice?.asksMinutes && (
            <label className="mt-4 block text-sm text-fg-2">
              Roughly how many minutes did you watch? <span className="text-muted">(optional)</span>
              <input type="number" min={0} max={999} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputClass} mt-1.5`} />
              <span className="mt-1 block text-xs text-muted">Helps us suggest it when you have just the time left.</span>
            </label>
          )}

          {outcome && (
            <div className="mt-5 animate-rise space-y-4 border-t border-line pt-5">
              <p className="text-sm font-medium">What did you think? <span className="font-normal text-muted">Optional</span></p>
              <label className="block text-sm text-fg-2">
                Your rating
                <select value={rating} onChange={(e) => setRating(e.target.value)} className={`${inputClass} mt-1.5`}>
                  <option value="">No rating</option>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n} / 10</option>)}
                </select>
              </label>
              <label className="block text-sm text-fg-2">
                A note for yourself
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} rows={2} className={`${inputClass} mt-1.5 h-auto py-2`} />
              </label>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Not now</Button>
            <Button type="submit" disabled={!outcome || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
