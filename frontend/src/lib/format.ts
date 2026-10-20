import type { Availability, Mood, Outcome, ViewingContext, WatchStatus } from '../types/api'

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return 'Runtime unknown'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h}h ${m}m` : `${h}h`
}

export const STATUS_LABELS: Record<WatchStatus, string> = {
  want_to_watch: 'Want to watch',
  watching: 'Watching',
  paused: 'Paused',
  watched: 'Watched',
  abandoned: 'Abandoned',
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  in_progress: 'Watching now',
  completed: 'Finished',
  interrupted: 'Watched part of it',
  paused: 'Paused for later',
  abandoned: 'Stopped watching',
}

export const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: 'anything', label: 'Anything goes' },
  { value: 'lighthearted', label: 'Lighthearted' },
  { value: 'exciting', label: 'Exciting' },
  { value: 'thought_provoking', label: 'Thought-provoking' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'suspenseful', label: 'Suspenseful' },
  { value: 'comfort', label: 'Comfort watch' },
]

export const CONTEXT_OPTIONS: { value: ViewingContext; label: string }[] = [
  { value: 'alone', label: 'Just me' },
  { value: 'date_night', label: 'Date night' },
  { value: 'friends', label: 'With friends' },
  { value: 'family', label: 'With family' },
]

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function posterUrl(path: string | null, size: 'w342' | 'w500' | 'w780' = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  anywhere: 'Anywhere',
  free: 'Free only',
  free_or_subscribed: 'Free or my services',
}

export const providerLogoUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w92${path}` : null)
