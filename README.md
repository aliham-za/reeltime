# ReelTime

**Less browsing. More watching.**

ReelTime is a movie commitment engine. Tell it how much time you have, and it picks a short list from *your own watchlist*: movies you're realistically likely to finish tonight, each with a plain reason why it fits.

It's not a catalog, a social network, or a chatbot. Recommendations are rule-based, deterministic and explainable.

```
backend/   Rails 7.2 JSON API · PostgreSQL · RSpec
frontend/  React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · React Router
```

## Quick start

Requirements: Ruby 3.1+, Node 20+, PostgreSQL 14+.

```bash
# API (http://localhost:3000)
cd backend
bundle install
cp .env.example .env          # optional: add a TMDB token
bin/rails db:prepare          # creates, migrates and seeds the database
bin/rails server

# Web app (http://localhost:5173), in another terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the seeded development account:

| Email | Password |
|---|---|
| `demo@reeltime.test` | `watchmore123` |

The account only exists in development. Its watchlist starts with 16 movies: TMDB's current popular movies if a TMDB key is set, otherwise the fictional sample catalog below. You can also create your own account from the sign-in page.

Vite proxies `/api` to Rails, so the browser only ever talks to one origin. The session cookie stays `SameSite=Lax` and `HttpOnly`, and no CORS setup is needed in development.

### Movie data (TMDB)

Without credentials, `db:seed` creates a **built-in sample catalog of 32 fictional movies** (`source: "local"`). They're invented titles, labelled as such in the UI, so the whole app works offline and can be tested end to end. Genres use TMDB's real genre IDs, so sample movies and imported movies share one genre table.

To search real movies, get a free API Read Access Token from <https://developer.themoviedb.org/docs/getting-started> and set it in `backend/.env`:

```
TMDB_API_TOKEN=eyJhbGciOi...
```

The token stays on the server. Search and popular results come from TMDB (cached for 6 hours). A movie is only imported, with its runtime and genres, when someone opens it or adds it to a watchlist. If TMDB is unreachable, search falls back to movies already stored locally, and recommendations never depend on TMDB at all.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Tests

```bash
cd backend && bundle exec rspec     # recommendation engine, API, auth, lifecycle, TMDB fallback
cd frontend && npm test             # planner and results flows
cd frontend && npm run typecheck    # strict TypeScript
```

## How recommendations work

Everything lives in [`backend/app/services/recommendations/engine.rb`](backend/app/services/recommendations/engine.rb).

1. **Pool**: the user's watchlist, minus *Watched*. *Abandoned* movies are only included when the user asks to reconsider them. "Continue something I started" uses only *Watching* and *Paused* movies.
2. **Hard constraints**: with *Finish in one sitting* (the default) or *Continue*, any movie whose runtime is longer than the window, or unknown, is excluded. A high score can never buy its way past this. For a started movie, only the *remaining* runtime has to fit, using progress recorded on its last attempt.
3. **Scoring**: each component is normalised to 0–1.

   | Component | Weight | Signal |
   |---|---|---|
   | genre | 0.40 | Any match with the selected genres scores 0.5; covering more of them adds the rest |
   | runtime | 0.30 | 1.0 when the movie uses 60–90% of the window; tapers for very short or very tight fits |
   | priority | 0.20 | The user starred it |
   | mood | 0.15 | Movie genres overlap the genres mapped to that mood (the only mood signal the metadata supports) |
   | personal interest | 0.10 | The user's own rating, if any |

   Only components with a real signal for the request are used, and their weights are re-normalised to sum to 1. A preference the user didn't give redistributes its weight instead of counting as zero. These weights are starting values, not tuned ones.
4. **Ranking**: score, then priority, then oldest-added first (so long-saved movies surface), then id. The order is fully deterministic.
5. **Diversity**: a greedy pass that penalises a candidate by its genre overlap with picks already made (Jaccard × 0.15). It only reorders eligible movies.
6. **Explanations**: every line comes from the request or the user's own watchlist entry ("Fits your 75-minute window with 15 minutes to spare.", "You marked this as a priority."). There are no claims about viewing habits.

**Viewing context** (alone, date night, …) is recorded but deliberately not scored. Without age ratings or content data there's no honest rule for it yet.

Each request is stored as a `recommendation_session`, with its shortlist snapshotted in `recommendation_items` (rank, score components, explanations, `algorithm_version`). It also records what was chosen or postponed, so ranking changes can be compared against real outcomes later.

## Data model

- `watchlist_items` hold a movie's **overall status** (want to watch / watching / paused / watched / abandoned), plus priority and rating. Each `(user, movie)` pair is unique.
- `watch_sessions` are individual **attempts**, with outcome `in_progress`, `completed`, `paused`, `interrupted` or `abandoned`. A user can stop a movie once and finish it later; both attempts are kept. The watchlist status follows the most recent attempt, and correcting an old record re-syncs it. A partial unique index allows only one open attempt per movie.
- Database check constraints back up the model validations (statuses, outcomes, rating 1–10, runtime range).

## API

All endpoints are under `/api/v1`, return `{ data, meta? }`, and report errors as `{ error: { code, message, details? } }`. Everything except register and login requires a session, and every user-owned record is looked up through `current_user`.

| | |
|---|---|
| `POST auth/register` · `POST auth/login` · `DELETE auth/logout` · `GET me` | Session auth (bcrypt; rate-limited) |
| `GET genres` | Genre list |
| `GET movies` · `GET movies/:id` · `GET movies/search?q=` · `GET movies/popular` · `GET movies/tmdb/:tmdb_id` | Catalog; the last one imports from TMDB |
| `GET movies/discover` | Browse all of TMDB by `genre_id`, `year` and `max_runtime` (minutes); falls back to filtering local movies |
| `GET/POST watchlist` · `GET/PATCH/DELETE watchlist/:id` · `GET watchlist/summary` | `status`, `genre_id`, `q`, `sort` (`recent`, `title`, `runtime`, `priority`), `page`, `per_page` |
| `POST recommendations` · `GET recommendations/:id` · `GET recommendations/preview` | Body: `available_minutes` (10–360), `mood`, `genre_ids[]`, `viewing_context`, `completion_preference`, `include_abandoned`, `limit` (1–5) |
| `POST recommendations/:id/select` · `POST recommendations/:id/dismiss` | Choose a pick / "Not tonight" |
| `GET/POST watch_sessions` · `GET/PATCH watch_sessions/:id` | Start (or resume) an attempt, record its outcome, or correct one |
| `GET insights/overview` | Only shown with enough data (averages need ≥3 finished movies) |

## Production notes

- Set `RAILS_MASTER_KEY`, `REELTIME_DATABASE_PASSWORD` and `TMDB_API_TOKEN`; serve over HTTPS (the session cookie is `Secure` in production).
- The simplest deployment serves the built frontend (`npm run build` → `frontend/dist`) from the same origin as the API. If you host them separately, add `rack-cors` restricted to the frontend origin and revisit the cookie's `SameSite` setting.
- The cache (TMDB responses, rate limits) is a per-process memory store. Switch to Solid Cache or Redis when running more than one server process.

## Roadmap (not built yet)

Learning from finished and abandoned attempts per time window, saved planner presets, spotting repeatedly postponed movies, and comparing ranking strategies using the recorded sessions. Anything heavier, such as learning-to-rank or bandits, only once there's enough real interaction data to justify it.
