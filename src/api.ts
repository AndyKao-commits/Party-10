import type { Room, Order } from './types'

const API = import.meta.env.VITE_API_URL || ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || '請求失敗') as Error & { code?: string; remaining?: number }
    err.code = data.code
    err.remaining = data.remaining
    throw err
  }
  return data as T
}

export function createRoom(body: Record<string, unknown>) {
  return req<{ hostId: string; room: Room }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getRoom(code: string) {
  return req<{ room: Room }>(`/api/rooms/${code}`)
}

export function joinRoom(code: string, nickname: string) {
  return req<{ playerId: string; room: Room }>(`/api/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  })
}

export function openSale(code: string, hostId: string) {
  return req<{ room: Room }>(`/api/rooms/${code}/open`, {
    method: 'POST',
    body: JSON.stringify({ hostId }),
  })
}

export function resetStock(code: string, hostId: string, saleInSec = 20) {
  return req<{ room: Room }>(`/api/rooms/${code}/reset-stock`, {
    method: 'POST',
    body: JSON.stringify({ hostId, saleInSec }),
  })
}

export function purchase(
  code: string,
  body: { playerId: string; areaId: string; qty: number; nickname: string },
) {
  return req<{ order: Order; room: Room }>(`/api/rooms/${code}/purchase`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function wsUrl(code: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.env.DEV ? `${location.hostname}:3001` : location.host
  return `${proto}://${host}/ws?code=${encodeURIComponent(code)}`
}
