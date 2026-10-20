import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'sm'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-[#c6f785] font-semibold',
  secondary: 'bg-elevated text-fg hover:bg-[#2e3340] border border-line',
  ghost: 'text-fg-2 hover:text-fg hover:bg-elevated',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra = '') =>
  `inline-flex items-center justify-center rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${variants[variant]} ${sizes[size]} ${extra}`

export function Button({ variant, size, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({ variant, size, className = '', ...props }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

/** Toggle chip. Selected state is conveyed by aria-pressed and a check mark, not color alone. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
        selected ? 'border-accent/60 bg-accent/12 text-fg' : 'border-line bg-card text-fg-2 hover:border-fg-2/40 hover:text-fg'
      }`}
    >
      {selected && <span aria-hidden className="text-accent">✓</span>}
      {children}
    </button>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ title, description, children, icon }: { title: string; description: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-fg-2">{description}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/8 px-6 py-8 text-center">
      <p className="font-medium text-fg">We couldn't load this.</p>
      <p className="mt-1 text-sm text-fg-2">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-elevated/70 ${className}`} />
}

export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg-2">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-fg placeholder:text-muted focus:border-accent/60 focus:outline-none focus-visible:outline-none'
