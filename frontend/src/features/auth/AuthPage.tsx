import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { queryClient } from '../../lib/query-client'
import { Button, Field, inputClass } from '../../components/ui'
import { Logo } from '../../components/layout'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const auth = useMutation({
    mutationFn: () => (mode === 'login' ? api.login(email, password) : api.register(email, password)),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    auth.mutate()
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{mode === 'login' ? 'Welcome back.' : 'Less browsing. More watching.'}</h1>
        <p className="mt-2 text-fg-2">
          {mode === 'login' ? 'Sign in to pick up your watchlist.' : 'Create an account to save your watchlist and viewing history.'}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
            <input
              id="password" type="password" required minLength={8} className={inputClass} value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {auth.error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg">
              {auth.error.message}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={auth.isPending}>
            {auth.isPending ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-sm text-fg-2">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); auth.reset() }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  )
}
