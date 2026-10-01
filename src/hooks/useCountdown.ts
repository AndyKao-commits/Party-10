import { useEffect, useState } from 'react'

export function useCountdown(targetAt: number | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [])
  if (!targetAt) return { ms: 0, done: true, label: '00:00:00' }
  const ms = Math.max(0, targetAt - now)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const cs = Math.floor((ms % 1000) / 10)
  const label =
    h > 0
      ? `${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}.${pad(cs)}`
  return { ms, done: ms <= 0, label }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
