import type { Room, Order } from './types'
import { isSupabaseMode } from './lib/supabase'
import { supabaseApi } from './lib/supabaseApi'

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
  if (isSupabaseMode) return supabaseApi.createRoom(body)
  return req<{ hostId: string; room: Room }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getFeatured() {
  if (isSupabaseMode) return supabaseApi.getFeatured()
  return req<{ room: Room; hostHint: string }>('/api/featured')
}

export function claimFeaturedHost(nickname: string) {
  if (isSupabaseMode) return supabaseApi.claimFeaturedHost(nickname)
  return req<{ hostId: string; room: Room }>('/api/featured/claim-host', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  })
}

export function getRoom(code: string) {
  if (isSupabaseMode) return supabaseApi.getRoom(code)
  return req<{ room: Room }>(`/api/rooms/${code}`)
}

export function joinRoom(code: string, nickname: string) {
  if (isSupabaseMode) return supabaseApi.joinRoom(code, nickname)
  return req<{ playerId: string; room: Room }>(`/api/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  })
}

export function openSale(code: string, hostId: string) {
  if (isSupabaseMode) return supabaseApi.openSale(code, hostId)
  return req<{ room: Room }>(`/api/rooms/${code}/open`, {
    method: 'POST',
    body: JSON.stringify({ hostId }),
  })
}

export function resetStock(code: string, hostId: string, saleInSec = 20) {
  if (isSupabaseMode) return supabaseApi.resetStock(code, hostId, saleInSec)
  return req<{ room: Room }>(`/api/rooms/${code}/reset-stock`, {
    method: 'POST',
    body: JSON.stringify({ hostId, saleInSec }),
  })
}

export function purchase(
  code: string,
  body: { playerId: string; areaId: string; qty: number; nickname: string },
) {
  if (isSupabaseMode) return supabaseApi.purchase(code, body)
  return req<{ order: Order; room: Room }>(`/api/rooms/${code}/purchase`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function joinUrl(code: string) {
  return `${location.origin}/join?code=${encodeURIComponent(code)}`
}

export function wsUrl(code: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws?code=${encodeURIComponent(code)}`
}

export { isSupabaseMode }
