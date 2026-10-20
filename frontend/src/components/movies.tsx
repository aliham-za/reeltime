import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Genre, Movie, WatchStatus } from '../types/api'
import { formatRuntime, posterUrl, STATUS_LABELS } from '../lib/format'

export function Poster({ movie, size = 'w342', className = '' }: { movie: Movie; size?: 'w342' | 'w500' | 'w780'; className?: string }) {
  const src = posterUrl(movie.poster_path, size)
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-xl border border-line/60 bg-elevated ${className}`}>
      {src ? (
        <img src={src} alt={`Poster for ${movie.title}`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        // No artwork: a typographic placeholder rather than a fake poster.
        <div className="@container flex h-full flex-col justify-end p-[8%]" role="img" aria-label={`${movie.title} (no poster)`}>
          <span className="line-clamp-4 text-balance break-words text-[9px] font-semibold leading-tight text-fg-2 @[5rem]:text-xs @[8rem]:text-lg">{movie.title}</span>
        </div>
      )}
    </div>
  )
}

export const RuntimeLabel = ({ minutes }: { minutes: number | null }) => (
  <span className="tabular-nums">{formatRuntime(minutes)}</span>
)

export function GenreBadges({ genres, max = 2 }: { genres: Genre[]; max?: number }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {genres.slice(0, max).map((g) => (
        <span key={g.id} className="rounded-md bg-elevated px-2 py-0.5 text-xs text-fg-2">{g.name}</span>
      ))}
    </span>
  )
}

const statusTone: Record<WatchStatus, string> = {
  want_to_watch: 'text-fg-2 border-line',
  watching: 'text-accent border-accent/40',
  paused: 'text-violet border-violet/40',
  watched: 'text-success border-success/40',
  abandoned: 'text-muted border-line',
}
const statusGlyph: Record<WatchStatus, string> = { want_to_watch: '○', watching: '▶', paused: '❙❙', watched: '✓', abandoned: '–' }

export function StatusBadge({ status }: { status: WatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border bg-canvas/80 px-2 py-0.5 text-xs font-medium backdrop-blur ${statusTone[status]}`}>
      <span aria-hidden className="text-[10px]">{statusGlyph[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function movieHref(movie: Movie) {
  return movie.id ? `/movies/${movie.id}` : `/movies/tmdb/${movie.tmdb_id}`
}

export function MovieMeta({ movie }: { movie: Movie }) {
  return (
    <p className="text-sm text-fg-2">
      {[movie.release_year, movie.runtime_minutes ? formatRuntime(movie.runtime_minutes) : null].filter(Boolean).join(' · ') || '—'}
    </p>
  )
}

/** The one movie card used everywhere. `actions` sit on the poster corner; `footer` holds page-specific controls. */
export function MovieCard({ movie, status, badge, actions, footer }: { movie: Movie; status?: WatchStatus; badge?: ReactNode; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <article className="group flex flex-col">
      <div className="relative transition-transform duration-200 group-hover:-translate-y-0.5">
        <Link to={movieHref(movie)} className="block rounded-xl">
          <Poster movie={movie} className="group-hover:border-fg-2/30" />
        </Link>
        {(status || badge) && (
          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
            {status && <StatusBadge status={status} />}
            {badge}
          </div>
        )}
        {actions && <div className="absolute right-2 top-2 flex gap-1.5">{actions}</div>}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <h3 className="line-clamp-2 font-semibold leading-snug">
          <Link to={movieHref(movie)} className="hover:text-accent">{movie.title}</Link>
        </h3>
        <MovieMeta movie={movie} />
        <GenreBadges genres={movie.genres} />
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </div>
    </article>
  )
}

export const movieGridClass = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
