import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../../lib/api'
import { renderPage } from '../../test/render'
import { PlannerPage } from './PlannerPage'

vi.mock('../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../lib/api')>()),
  api: {
    me: vi.fn(),
    watchlistSummary: vi.fn(),
    genres: vi.fn(),
    previewCount: vi.fn(),
    recommend: vi.fn(),
  },
}))

const mocked = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
  mocked.watchlistSummary.mockResolvedValue({ total: 5, by_status: { want_to_watch: 5, watching: 0, paused: 0, watched: 0, abandoned: 0 }, fits_window: {} })
  mocked.genres.mockResolvedValue([{ id: 4, name: 'Comedy' }, { id: 9, name: 'Mystery' }])
  mocked.previewCount.mockResolvedValue(3)
  mocked.me.mockResolvedValue({ id: 1, email: 'a@b.test', country: 'PK', subscribed_provider_ids: [], created_at: '' })
})

it('submits the chosen time, mood and genres', async () => {
  mocked.recommend.mockResolvedValue({ id: 42 } as never)
  const user = userEvent.setup()
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan' })

  await user.click(await screen.findByRole('radio', { name: /75/ }))
  await user.click(screen.getByRole('button', { name: /add mood/i }))
  await user.click(screen.getByRole('button', { name: 'Lighthearted' }))
  await user.click(await screen.findByRole('button', { name: 'Mystery' }))
  expect(screen.getByRole('button', { name: /Mystery/ })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Find my movie' }))

  await waitFor(() => expect(mocked.recommend).toHaveBeenCalled())
  expect(mocked.recommend.mock.calls[0][0]).toEqual({
      available_minutes: 75,
      mood: 'lighthearted',
      genre_ids: [9],
      viewing_context: undefined,
    completion_preference: 'single_sitting',
    availability: 'anywhere',
    limit: 5,
  })
  expect(await screen.findByText('navigated')).toBeInTheDocument()
})

it('shows how many movies fit', async () => {
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan?minutes=60' })
  expect(await screen.findByText(/on your watchlist fit in 60 minutes/)).toBeInTheDocument()
  expect(mocked.previewCount).toHaveBeenCalledWith({ available_minutes: 60, completion_preference: 'single_sitting', availability: 'anywhere' })
})

it('blocks an out-of-range custom time', async () => {
  const user = userEvent.setup()
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan' })

  await user.click(await screen.findByRole('radio', { name: /custom/i }))
  const input = screen.getByLabelText('Minutes available')
  await user.clear(input)
  await user.type(input, '500')

  expect(screen.getByRole('alert')).toHaveTextContent('between 10 and 360')
  expect(screen.getByRole('button', { name: 'Find my movie' })).toBeDisabled()
})

it('lets keyboard users pick a preset', async () => {
  const user = userEvent.setup()
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan' })

  const ninety = await screen.findByRole('radio', { name: /90/ })
  ninety.focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('radio', { name: /120/ })).toBeChecked()
})

it('points to discovery when the watchlist is empty', async () => {
  mocked.watchlistSummary.mockResolvedValue({ total: 0, by_status: { want_to_watch: 0, watching: 0, paused: 0, watched: 0, abandoned: 0 }, fits_window: {} })
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan' })
  expect(await screen.findByText('Nothing on your watchlist yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Discover movies' })).toHaveAttribute('href', '/discover')
})

it('filters by where you can watch, and nudges you to add services', async () => {
  mocked.recommend.mockResolvedValue({ id: 1 } as never)
  const user = userEvent.setup()
  renderPage(<PlannerPage />, { path: '/plan', route: '/plan' })

  await user.click(await screen.findByRole('radio', { name: 'Free only' }))
  await waitFor(() => expect(mocked.previewCount).toHaveBeenLastCalledWith(expect.objectContaining({ availability: 'free' })))
  expect(await screen.findByText(/on your watchlist free to watch fit in 90 minutes/)).toBeInTheDocument()
  expect(screen.getByText('Streaming availability in PK.')).toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Free or my services' }))
  expect(screen.getByRole('link', { name: 'Add your services' })).toHaveAttribute('href', '/settings')

  await user.click(screen.getByRole('button', { name: 'Find my movie' }))
  await waitFor(() => expect(mocked.recommend.mock.calls[0][0]).toMatchObject({ availability: 'free_or_subscribed' }))
})
