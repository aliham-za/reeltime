import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../../lib/api'
import type { RecommendationSession } from '../../types/api'
import { renderPage } from '../../test/render'
import { ResultsPage } from './ResultsPage'

vi.mock('../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../lib/api')>()),
  api: { recommendation: vi.fn(), genres: vi.fn(), chooseRecommendation: vi.fn(), dismissRecommendation: vi.fn(), startWatching: vi.fn() },
}))
const mocked = vi.mocked(api)

const movie = (id: number, title: string) => ({
  id, tmdb_id: null, source: 'local' as const, title, original_title: title, overview: 'An overview.', release_date: null,
  release_year: 2020, runtime_minutes: 70, poster_path: null, backdrop_path: null, original_language: 'en', genres: [{ id: 4, name: 'Comedy' }],
})

function session(overrides: Partial<RecommendationSession> = {}): RecommendationSession {
  return {
    id: 7, created_at: '', algorithm_version: 'rules-v1', candidate_count: 1, selected_movie_id: null,
    exclusions: null,
    constraints: { available_minutes: 75, mood: null, genre_ids: [4], viewing_context: null, completion_preference: 'single_sitting', include_abandoned: false, availability: 'anywhere', region: 'US' },
    items: [{
      id: 1, rank: 1, total_score: 0.9, score_components: {}, headline: 'Fits your 75-minute window', selected_at: null, dismissed_at: null,
      reasons: [{ code: 'runtime_fit', text: 'Fits your 75-minute window with 5 minutes to spare.' }, { code: 'genre_match', text: 'Matches your pick: Comedy.' }],
      movie: movie(11, 'Paper Moons'),
    }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.genres.mockResolvedValue([{ id: 4, name: 'Comedy' }])
})

const renderResults = () => renderPage(<ResultsPage />, { path: '/plan/results/:sessionId', route: '/plan/results/7' })

it('shows each pick with its reasons and the session constraints', async () => {
  mocked.recommendation.mockResolvedValue(session())
  renderResults()

  expect(await screen.findByRole('heading', { name: 'Paper Moons' })).toBeInTheDocument()
  expect(screen.getByText('Matches your pick: Comedy.')).toBeInTheDocument()
  expect(screen.getByText('1h 15m')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adjust' })).toHaveAttribute('href', '/plan?minutes=75&completion=single_sitting&genres=4')
})

it('selects a movie and offers to start watching', async () => {
  mocked.recommendation.mockResolvedValue(session())
  mocked.chooseRecommendation.mockResolvedValue(session({ selected_movie_id: 11 }))
  const user = userEvent.setup()
  renderResults()

  await user.click(await screen.findByRole('button', { name: "Let's watch this" }))
  await waitFor(() => expect(mocked.chooseRecommendation).toHaveBeenCalledWith(7, 11))
  expect(await screen.findByRole('button', { name: /start watching now/i })).toBeInTheDocument()
})

it('explains an empty result instead of inventing picks', async () => {
  mocked.recommendation.mockResolvedValue(session({ items: [], candidate_count: 0, exclusions: { too_long: 3, missing_runtime: 0 } }))
  renderResults()

  expect(await screen.findByText('Nothing fits your time window right now.')).toBeInTheDocument()
  expect(screen.getByText('3 movies run longer than 75 minutes.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adjust my time' })).toBeInTheDocument()
})

it('shows an error with retry when loading fails', async () => {
  mocked.recommendation.mockRejectedValue(new Error('Server unavailable'))
  renderResults()
  expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

function fivePicks(dismissedRanks: number[] = []) {
  const base = session()
  const template = base.items[0]
  return session({
    candidate_count: 9,
    items: [1, 2, 3, 4, 5].map((rank) => ({
      ...template, id: rank, rank, movie: movie(100 + rank, `Pick ${rank}`),
      dismissed_at: dismissedRanks.includes(rank) ? '2026-10-21T00:00:00Z' : null,
    })),
  })
}
const pickTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

it('shows the top 3 picks and reveals the rest on request', async () => {
  mocked.recommendation.mockResolvedValue(fivePicks())
  const user = userEvent.setup()
  renderResults()

  await screen.findByRole('heading', { name: 'Pick 1' })
  expect(pickTitles()).toEqual(['Pick 1', 'Pick 2', 'Pick 3'])

  await user.click(screen.getByRole('button', { name: 'Show 2 more options' }))
  expect(pickTitles()).toEqual(['Pick 1', 'Pick 2', 'Pick 3', 'Pick 4', 'Pick 5'])
  expect(screen.queryByRole('button', { name: /more option/ })).not.toBeInTheDocument()
})

it('fills a "Not tonight" gap with the next-ranked pick', async () => {
  mocked.recommendation.mockResolvedValue(fivePicks())
  mocked.dismissRecommendation.mockResolvedValue(fivePicks([2]))
  const user = userEvent.setup()
  renderResults()

  await screen.findByRole('heading', { name: 'Pick 2' })
  await user.click(screen.getAllByRole('button', { name: 'Not tonight' })[1])

  await waitFor(() => expect(pickTitles()).toEqual(['Pick 1', 'Pick 3', 'Pick 4']))
  expect(mocked.dismissRecommendation).toHaveBeenCalledWith(7, 102)
  expect(screen.getByRole('button', { name: 'Show 1 more option' })).toBeInTheDocument()
})
