import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../../lib/api'
import { renderPage } from '../../test/render'
import { DiscoverPage } from './DiscoverPage'

vi.mock('../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../lib/api')>()),
  api: { genres: vi.fn(), popularMovies: vi.fn(), discoverMovies: vi.fn(), searchMovies: vi.fn() },
}))
const mocked = vi.mocked(api)
const empty = { data: [], meta: { page: 1, total_pages: 1, source: 'tmdb' as const } }

beforeEach(() => {
  vi.resetAllMocks()
  mocked.genres.mockResolvedValue([{ id: 4, name: 'Comedy' }])
  mocked.popularMovies.mockResolvedValue(empty)
  mocked.discoverMovies.mockResolvedValue(empty)
})

it('browses popular movies until a filter is chosen, then discovers with the filters', async () => {
  const user = userEvent.setup()
  renderPage(<DiscoverPage />, { path: '/discover', route: '/discover' })
  await waitFor(() => expect(mocked.popularMovies).toHaveBeenCalledWith(1))

  await screen.findByRole('option', { name: 'Comedy' })
  await user.selectOptions(screen.getByLabelText('Genre'), 'Comedy')
  await user.selectOptions(screen.getByLabelText('Maximum runtime'), 'Under 1h 30m')

  await waitFor(() => expect(mocked.discoverMovies).toHaveBeenLastCalledWith({ genre_id: 4, year: undefined, max_runtime: 90 }, 1))
  expect(screen.getByRole('heading', { name: 'Comedy under 1h 30m' })).toBeInTheDocument()
  expect(await screen.findByText('No movies match these filters.')).toBeInTheDocument()
})

it('restores filters from the URL', async () => {
  renderPage(<DiscoverPage />, { path: '/discover', route: '/discover?year=2001&page=3' })
  await waitFor(() => expect(mocked.discoverMovies).toHaveBeenCalledWith({ genre_id: undefined, year: 2001, max_runtime: undefined }, 3))
})
