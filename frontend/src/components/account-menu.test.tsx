import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { User } from '../types/api'
import { renderPage } from '../test/render'
import { AccountMenu } from './account-menu'

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: { logout: vi.fn() } }))
const mocked = vi.mocked(api)
const user: User = { id: 1, email: 'ali@example.test', country: 'PK', subscribed_provider_ids: [], created_at: '' }

/** Stands in for AuthGate: shows the menu while signed in, a marker once `me` is null. */
function Harness() {
  const client = useQueryClient()
  if (client.getQueryData(['me']) === undefined) client.setQueryData(['me'], user)
  client.setQueryData(['watchlist'], { secret: true })
  const me = useQuery<User | null>({ queryKey: ['me'], queryFn: () => user, staleTime: Infinity })
  return me.data === null ? <p>sign-in screen</p> : <AccountMenu user={user} />
}

beforeEach(() => vi.resetAllMocks())

it('opens the menu, signs out and returns to the sign-in screen', async () => {
  mocked.logout.mockResolvedValue(undefined)
  const u = userEvent.setup()
  renderPage(<Harness />)

  await u.click(screen.getByRole('button', { name: /ali@example.test/ }))
  expect(screen.getByRole('menu')).toHaveTextContent('Signed in as')
  await u.click(screen.getByRole('menuitem', { name: 'Sign out' }))

  expect(await screen.findByText('sign-in screen')).toBeInTheDocument()
  expect(mocked.logout).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('Signed out.')).toBeInTheDocument()
})

it('stays signed in and explains when sign-out fails', async () => {
  mocked.logout.mockRejectedValue(new Error('offline'))
  const u = userEvent.setup()
  renderPage(<Harness />)

  await u.click(screen.getByRole('button', { name: /ali@example.test/ }))
  await u.click(screen.getByRole('menuitem', { name: 'Sign out' }))

  expect(await screen.findByText(/Couldn't sign you out/)).toBeInTheDocument()
  expect(screen.queryByText('sign-in screen')).not.toBeInTheDocument()
})

it('closes with Escape and returns focus to the trigger', async () => {
  const u = userEvent.setup()
  renderPage(<Harness />)
  const trigger = screen.getByRole('button', { name: /ali@example.test/ })

  await u.click(trigger)
  await u.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
