import { screen } from '@testing-library/react'
import { api } from '../lib/api'
import { renderPage } from '../test/render'
import { WhereToWatch } from './where-to-watch'

vi.mock('../lib/api', async (orig) => ({
  ...(await orig<typeof import('../lib/api')>()),
  api: { availability: vi.fn() },
}))
const mocked = vi.mocked(api)
const provider = (id: number, name: string, subscribed = false) => ({ id, name, logo_path: `/${id}.png`, subscribed })

beforeEach(() => vi.resetAllMocks())

it('groups providers and marks the services you have', async () => {
  mocked.availability.mockResolvedValue({
    region: 'US', link: 'https://www.themoviedb.org/movie/1/watch?locale=US',
    groups: { free: [provider(73, 'Tubi')], subscription: [provider(8, 'Netflix', true)], rent: [], buy: [] },
  })
  renderPage(<WhereToWatch movieId={1} />)

  expect(await screen.findByText('Free')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Tubi' })).toBeInTheDocument()
  expect(screen.getByTitle('Netflix (you have this)')).toBeInTheDocument()
  expect(screen.queryByText('Rent')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'JustWatch' })).toBeInTheDocument()
})

it('says when a movie is not streaming in your country', async () => {
  mocked.availability.mockResolvedValue({ region: 'PK', link: null, groups: { free: [], subscription: [], rent: [], buy: [] } })
  renderPage(<WhereToWatch movieId={1} />)
  expect(await screen.findByText(/Not streaming in PK right now/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Change country' })).toHaveAttribute('href', '/settings')
})
