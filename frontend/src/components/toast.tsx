import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export const useToast = () => useContext(ToastContext)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = nextId++
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise rounded-xl border px-4 py-2.5 text-sm shadow-lg shadow-black/30 ${
              t.tone === 'error' ? 'border-danger/40 bg-[#2a1a1c] text-fg' : 'border-line bg-elevated text-fg'
            }`}
          >
            <span aria-hidden className={t.tone === 'error' ? 'mr-2 text-danger' : 'mr-2 text-accent'}>{t.tone === 'error' ? '!' : '✓'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
