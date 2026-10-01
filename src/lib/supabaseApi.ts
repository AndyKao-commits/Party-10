import type { Order, Room, TicketArea } from '../types'
import { getSupabase } from './supabase'

type RoomRow = {
  code: string
  host_id: string
  title: string
  subtitle: string
  venue: string
  date_text: string
  sale_at: string
  sale_open: boolean
  max_per_order: number
  queue_delay_ms: number
  fail_chance: number
  notices: string[] | null
}

type AreaRow = {
  id: string
  name: string
  price: number
  total: number
  remaining: number
  color: string
}

type OrderRow = {
  id: string
  nickname: string
  area_name: string
  qty: number
  seats: string[]
  code: string
  created_at: string
}

function mapAreas(rows: AreaRow[]): TicketArea[] {
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    total: a.total,
    remaining: a.remaining,
    color: a.color,
    soldOut: a.remaining <= 0,
  }))
}

function mapOrders(rows: OrderRow[]): Order[] {
  return rows.map((o) => ({
    id: o.id,
    nickname: o.nickname,
    areaName: o.area_name,
    qty: o.qty,
    seats: o.seats || [],
    code: o.code,
    createdAt: new Date(o.created_at).getTime(),
  }))
}

async function loadRoom(code: string): Promise<Room> {
  const sb = getSupabase()!
  const c = code.toUpperCase()
  const { data: room, error } = await sb.from('rooms').select('*').eq('code', c).single()
  if (error || !room) throw new Error(error?.message || '找不到房間')

  const [{ data: areas }, { data: orders }, { count: playerCount }] = await Promise.all([
    sb.from('areas').select('*').eq('room_code', c),
    sb.from('orders').select('*').eq('room_code', c).order('created_at', { ascending: false }),
    sb.from('players').select('*', { count: 'exact', head: true }).eq('room_code', c),
  ])

  const r = room as RoomRow
  const saleAt = new Date(r.sale_at).getTime()
  return {
    code: r.code,
    title: r.title,
    subtitle: r.subtitle,
    venue: r.venue,
    dateText: r.date_text,
    saleAt,
    saleOpen: r.sale_open || Date.now() >= saleAt,
    maxPerOrder: r.max_per_order,
    queueDelayMs: r.queue_delay_ms,
    failChance: r.fail_chance,
    areas: mapAreas((areas || []) as AreaRow[]),
    playerCount: playerCount || 0,
    orderCount: (orders || []).length,
    notices: r.notices || [],
    orders: mapOrders((orders || []) as OrderRow[]),
  }
}

function rpcError(err: { message?: string; code?: string }) {
  const msg = err.message || '請求失敗'
  const e = new Error(msg) as Error & { code?: string }
  if (msg.includes('尚未開賣')) e.code = 'NOT_OPEN'
  else if (msg.includes('忙碌') || msg.includes('過多')) e.code = 'BUSY'
  else if (msg.includes('售完') || msg.includes('不足')) e.code = 'SOLD_OUT'
  return e
}

export const supabaseApi = {
  async getFeatured() {
    const sb = getSupabase()!
    const { error } = await sb.rpc('ensure_featured_room')
    if (error) throw new Error(error.message)
    const { data: featured, error: fErr } = await sb
      .from('rooms')
      .select('code')
      .eq('is_featured', true)
      .limit(1)
      .maybeSingle()
    if (fErr || !featured) throw new Error(fErr?.message || '找不到主打場')
    const room = await loadRoom(featured.code)
    return { room, hostHint: 'claim-host' }
  },

  async claimFeaturedHost(nickname: string) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('claim_featured_host', { p_nickname: nickname })
    if (error) throw new Error(error.message)
    const payload = data as { hostId: string; code: string }
    const room = await loadRoom(payload.code)
    return { hostId: payload.hostId, room }
  },

  async getRoom(code: string) {
    return { room: await loadRoom(code) }
  },

  async joinRoom(code: string, nickname: string) {
    const sb = getSupabase()!
    const c = code.toUpperCase()
    const nick = (nickname || '訪客').slice(0, 20)
    const { data, error } = await sb
      .from('players')
      .insert({ room_code: c, nickname: nick, is_host: false })
      .select('id')
      .single()
    if (error) throw new Error(error.message || '加入失敗')
    return { playerId: data.id as string, room: await loadRoom(c) }
  },

  async listEvents() {
    const sb = getSupabase()!
    await sb.rpc('ensure_featured_room')
    const { data, error } = await sb
      .from('rooms')
      .select('code,title,subtitle,venue,date_text,sale_at,sale_open,is_featured')
      .order('is_featured', { ascending: false })
      .order('sale_at', { ascending: true })
    if (error) throw new Error(error.message)
    return {
      events: (data || []).map((r) => ({
        code: r.code as string,
        title: r.title as string,
        subtitle: (r.subtitle as string) || '',
        venue: (r.venue as string) || '',
        dateText: (r.date_text as string) || '',
        saleAt: new Date(r.sale_at as string).getTime(),
        saleOpen: Boolean(r.sale_open),
        featured: Boolean(r.is_featured),
      })),
    }
  },

  async createRoom(body: Record<string, unknown>) {
    const sb = getSupabase()!
    const hostId = crypto.randomUUID()
    const hostName = String(body.hostName || '主辦人').slice(0, 20)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const saleInSec = Math.max(5, Number(body.saleInSec ?? 30))
    const saleAt = body.saleAt
      ? new Date(String(body.saleAt)).toISOString()
      : new Date(Date.now() + saleInSec * 1000).toISOString()
    const featured = Boolean(body.featured)

    if (featured) {
      await sb.from('rooms').update({ is_featured: false }).eq('is_featured', true)
    }

    const { error } = await sb.from('rooms').insert({
      code,
      host_id: hostId,
      title: String(body.title || 'PARTY HOUSE 2026 小派對 WORLD TOUR').slice(0, 80),
      subtitle: String(body.subtitle || '＜FUN ONLY＞ in LIVING ROOM').slice(0, 80),
      venue: String(body.venue || '你家客廳・派對主舞台').slice(0, 80),
      date_text: String(body.dateText || '今晚・派對開演').slice(0, 80),
      sale_at: saleAt,
      sale_open: false,
      max_per_order: Math.min(4, Math.max(1, Number(body.maxPerOrder || 2))),
      queue_delay_ms: Math.min(8000, Math.max(800, Number(body.queueDelayMs || 2500))),
      fail_chance: Math.min(0.6, Math.max(0, Number(body.failChance ?? 0.15))),
      notices: [
        '本系統為派對娛樂用假搶票，一切票券皆為假的，沒有真實效力。',
        '為避免開賣時「登入逾時」，請於開賣前重新整理頁面確認連線狀態。',
        '每筆訂單限購張數以主辦設定為準。流量控管中請耐心等候。',
      ],
      is_featured: featured,
    })
    if (error) throw new Error(error.message)

    const defaults = [
      { id: 'vip', name: 'VIP 搖滾區', price: 5800, total: 4, remaining: 4, color: '#e11d48' },
      { id: 'a', name: '特 A 區', price: 4800, total: 8, remaining: 8, color: '#ea580c' },
      { id: 'b', name: '特 B 區', price: 3800, total: 12, remaining: 12, color: '#ca8a04' },
      { id: 'c', name: '二樓座席', price: 2800, total: 16, remaining: 16, color: '#16a34a' },
    ]
    const { error: aErr } = await sb.from('areas').insert(defaults.map((a) => ({ ...a, room_code: code })))
    if (aErr) throw new Error(aErr.message)
    const { error: pErr } = await sb.from('players').insert({
      id: hostId,
      room_code: code,
      nickname: hostName,
      is_host: true,
    })
    if (pErr) throw new Error(pErr.message)
    return { hostId, room: await loadRoom(code) }
  },

  async openSale(code: string, hostId: string) {
    const sb = getSupabase()!
    const { error } = await sb.rpc('open_room_sale', {
      p_code: code,
      p_host_id: hostId,
    })
    if (error) throw new Error(error.message)
    return { room: await loadRoom(code) }
  },

  async resetStock(code: string, hostId: string, saleInSec = 20) {
    const sb = getSupabase()!
    const { error } = await sb.rpc('reset_room_stock', {
      p_code: code,
      p_host_id: hostId,
      p_sale_in_sec: saleInSec,
    })
    if (error) throw new Error(error.message)
    return { room: await loadRoom(code) }
  },

  async purchase(
    code: string,
    body: { playerId: string; areaId: string; qty: number; nickname: string },
  ) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('purchase_tickets', {
      p_code: code,
      p_player_id: body.playerId || null,
      p_area_id: body.areaId,
      p_qty: body.qty,
      p_nickname: body.nickname,
    })
    if (error) throw rpcError(error)
    const order = (data as { order: Order }).order
    return { order, room: await loadRoom(code) }
  },

  subscribeRoom(code: string, onRoom: (room: Room) => void) {
    const sb = getSupabase()!
    const c = code.toUpperCase()
    let alive = true
    const refresh = async () => {
      try {
        if (!alive) return
        onRoom(await loadRoom(c))
      } catch {
        /* ignore transient */
      }
    }
    const channel = sb
      .channel(`room-${c}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${c}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas', filter: `room_code=eq.${c}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `room_code=eq.${c}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${c}` }, refresh)
      .subscribe()
    void refresh()
    return () => {
      alive = false
      void sb.removeChannel(channel)
    }
  },
}
