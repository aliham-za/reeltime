import { useId } from 'react'
import type { Genre, Mood } from '../types/api'
import { formatRuntime, MOOD_OPTIONS } from '../lib/format'
import { Chip } from './ui'

export const TIME_PRESETS = [30, 45, 60, 75, 90, 120] as const
export const MIN_MINUTES = 10
export const MAX_MINUTES = 360

/** Large radio-group time picker; arrow keys move between presets natively. */
export function TimeSelector({ value, custom, onChange }: { value: number; custom: boolean; onChange: (minutes: number, custom: boolean) => void }) {
  const name = useId()
  const optionClass = 'flex h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border text-center transition-all duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent'
  const on = 'border-accent bg-accent text-accent-ink'
  const off = 'border-line bg-card text-fg hover:border-fg-2/40'

  return (
    <fieldset>
      <legend className="sr-only">Available time</legend>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-7">
        {TIME_PRESETS.map((m) => {
          const checked = !custom && value === m
          return (
            <label key={m} className="relative">
              <input type="radio" name={name} className="peer sr-only" checked={checked} onChange={() => onChange(m, false)} />
              <span className={`${optionClass} ${checked ? on : off}`}>
                <span className="text-xl font-semibold tabular-nums">{m}</span>
                <span className={`text-xs ${checked ? 'text-accent-ink/70' : 'text-muted'}`}>min</span>
              </span>
            </label>
          )
        })}
        <label className="relative col-span-3 sm:col-span-1">
          <input type="radio" name={name} className="peer sr-only" checked={custom} onChange={() => onChange(value, true)} />
          <span className={`${optionClass} ${custom ? on : off}`}>
            <span className="text-base font-semibold">Custom</span>
            <span className={`text-xs ${custom ? 'text-accent-ink/70' : 'text-muted'}`}>any length</span>
          </span>
        </label>
      </div>
      {custom && (
        <div className="mt-4 flex animate-rise flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center">
          <label htmlFor={`${name}-custom`} className="text-sm text-fg-2 sm:w-32">Minutes available</label>
          <input
            type="range" min={MIN_MINUTES} max={MAX_MINUTES} step={5} value={value} aria-label="Minutes available (slider)"
            onChange={(e) => onChange(Number(e.target.value), true)} className="flex-1 accent-[#b8f36b]"
          />
          <input
            id={`${name}-custom`} type="number" inputMode="numeric" min={MIN_MINUTES} max={MAX_MINUTES} value={value}
            onChange={(e) => onChange(Number(e.target.value), true)}
            className="h-10 w-24 rounded-xl border border-line bg-surface px-3 text-right tabular-nums text-fg"
          />
        </div>
      )}
      <p className="mt-3 text-sm text-fg-2" aria-live="polite">
        <span className="tabular-nums text-fg">{formatRuntime(value)}</span> to spend
      </p>
    </fieldset>
  )
}

export function MoodSelector({ value, onChange }: { value: Mood | null; onChange: (mood: Mood | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
      {MOOD_OPTIONS.map((m) => (
        <Chip key={m.value} selected={value === m.value} onClick={() => onChange(value === m.value ? null : m.value)}>{m.label}</Chip>
      ))}
    </div>
  )
}

export function GenreSelector({ genres, value, onChange }: { genres: Genre[]; value: number[]; onChange: (ids: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Genres">
      {genres.map((g) => {
        const selected = value.includes(g.id)
        return (
          <Chip key={g.id} selected={selected} onClick={() => onChange(selected ? value.filter((id) => id !== g.id) : [...value, g.id])}>
            {g.name}
          </Chip>
        )
      })}
    </div>
  )
}
