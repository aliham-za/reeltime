import { Link } from 'react-router-dom'
import { formatDate, formatRuntime } from '../../lib/format'
import type { WatchSession } from '../../types/api'
import { Button } from '../../components/ui'
import { movieHref, Poster } from '../../components/movies'

/** An open attempt. Wraps the action under the title on narrow screens instead of overflowing. */
export function NowWatchingCard({ session, onReport }: { session: WatchSession; onReport: (s: WatchSession) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-accent/40 bg-card p-3">
      <Link to={movieHref(session.movie)} className="w-14 shrink-0"><Poster movie={session.movie} /></Link>
      <div className="min-w-0 flex-1 basis-40">
        <p className="line-clamp-2 font-semibold leading-snug">{session.movie.title}</p>
        <p className="mt-0.5 text-sm text-fg-2">
          Started {formatDate(session.started_at)} · <span className="tabular-nums">{formatRuntime(session.movie.runtime_minutes)}</span>
        </p>
      </div>
      <Button className="w-full sm:w-auto" onClick={() => onReport(session)}>How did it go?</Button>
    </div>
  )
}
