# ReelTime

**Less browsing. More watching.**

**Live:** https://reeltime-0dh2.onrender.com (free Render instance, so the first visit after idle takes 30–60 seconds)

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

### Where to watch

Movie pages show where a movie is **free**, on **subscription**, or for **rent/buy** in the user's country, using TMDB's watch-provider data (sourced from JustWatch, credited in the UI). Users set their country and subscriptions in **Settings**. The planner can then limit picks to *Free only* or *Free or my services*, and Discover has a *Free to watch* filter.

Availability is stored per movie and country in `movie_availabilities` and refreshed after 24 hours. TMDB is only called when a filter needs fresh data, and those calls run in parallel. Everything links to legal services only; ReelTime doesn't host, scrape or link to unlicensed streams.

TMDB's discover runtime filter is loose: it returns 95–137-minute movies for "under 90". So when Discover has a runtime cap, ReelTime checks each result's real runtime (cached) and draws on two TMDB pages per app page, so pages stay full.

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
| `GET movies/discover` | Browse all of TMDB by `genre_id`, `year`, `max_runtime` (minutes) and `free`; falls back to filtering local movies |
| `GET movies/:id/availability` | Where to watch in the user's country, grouped free / subscription / rent / buy |
| `PATCH me` | `country` (ISO code) and `subscribed_provider_ids[]` |
| `GET watch_providers/regions` · `GET watch_providers?region=` | Countries and streaming services for Settings |
| `GET/POST watchlist` · `GET/PATCH/DELETE watchlist/:id` · `GET watchlist/summary` | `status`, `genre_id`, `q`, `sort` (`recent`, `title`, `runtime`, `priority`), `page`, `per_page` |
| `POST recommendations` · `GET recommendations/:id` · `GET recommendations/preview` | Body: `available_minutes` (10–360), `mood`, `genre_ids[]`, `viewing_context`, `completion_preference`, `availability` (`anywhere`, `free`, `free_or_subscribed`), `include_abandoned`, `limit` (1–5) |
| `POST recommendations/:id/select` · `POST recommendations/:id/dismiss` | Choose a pick / "Not tonight" |
| `GET/POST watch_sessions` · `GET/PATCH watch_sessions/:id` | Start (or resume) an attempt, record its outcome, or correct one |
| `GET insights/overview` | Only shown with enough data (averages need ≥3 finished movies) |

## Deploying (Render + Neon)

One Docker image ([`Dockerfile`](Dockerfile)) builds the React app and serves it from Rails, so the frontend and API share one origin. Session cookies, rate limits and client-side routes all work without CORS or a proxy. The database is Postgres on [Neon](https://neon.tech) (free tier, no expiry).

1. **Neon:** create a project and copy the **direct** connection string (not the `-pooler` host; migrations need a direct connection). It looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.
2. **Render:** Dashboard → **New → Blueprint** → pick this repo. [`render.yaml`](render.yaml) defines one free Docker web service. When prompted, set:
   - `DATABASE_URL`: the Neon string from step 1
   - `TMDB_API_KEY`: your TMDB key
   - `SECRET_KEY_BASE` is generated by Render.
3. Deploy. On boot the container runs `bin/rails db:prepare`, which loads the schema and seeds genres plus popular TMDB movies on an empty database, then starts Puma. Later pushes to `main` redeploy automatically, and new migrations run on boot.

Things to know:
- Free Render services sleep after about 15 minutes idle, so the first request after that takes 30–60 seconds.
- The demo account is only seeded in development. In production, create your account on the sign-up page.
- The cache (TMDB responses, rate limits) is in-process memory and is cleared on each deploy or restart.
- To run the production image locally: `docker build -t reeltime .` then `docker run -p 3000:3000 -e DATABASE_URL=... -e SECRET_KEY_BASE=$(openssl rand -hex 64) -e TMDB_API_KEY=... reeltime`.

## Roadmap (not built yet)

Learning from finished and abandoned attempts per time window, saved planner presets, spotting repeatedly postponed movies, and comparing ranking strategies using the recorded sessions. Anything heavier, such as learning-to-rank or bandits, only once there's enough real interaction data to justify it.
