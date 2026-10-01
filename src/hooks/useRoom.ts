import { useEffect, useState } from 'react'
import type { Room, Session } from '../types'
import { getRoom, wsUrl } from '../api'

const SESSION_KEY = 'pbon-session'

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function useRoom(code: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!code) return
    let closed = false
    let ws: WebSocket | null = null
    let retry: number | undefined

    const boot = async () => {
      try {
        const { room: r } = await getRoom(code)
        if (!closed) setRoom(r)
      } catch (e) {
        if (!closed) setError(e instanceof Error ? e.message : '載入失敗')
      }

      const connect = () => {
        ws = new WebSocket(wsUrl(code))
        ws.onopen = () => {
          if (!closed) setConnected(true)
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.type === 'room' && !closed) setRoom(msg.room)
          } catch {
            /* ignore */
          }
        }
        ws.onclose = () => {
          if (closed) return
          setConnected(false)
          retry = window.setTimeout(connect, 1500)
        }
      }
      connect()
    }

    boot()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      ws?.close()
    }
  }, [code])

  return { room, error, connected, setRoom }
}
