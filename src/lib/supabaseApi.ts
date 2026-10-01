import type { FakeEvent } from '../data/catalog'
import type { Order, Room, TicketArea } from '../types'
import { getSupabase } from './supabase'

function mapDecoyRow(e: Record<string, unknown>): FakeEvent {
  return {
    id: e.id as string,
    slug: e.slug as string,
    title: e.title as string,
    subtitle: (e.subtitle as string) || '',
    category: e.category as FakeEvent['category'],
    venue: (e.venue as string) || '',
    dateText: (e.date_text as string) || '',
    priceText: (e.price_text as string) || '',
    status: e.status as FakeEvent['status'],
    badge: (e.badge as string) || undefined,
    gradient: (e.gradient as string) || 'linear-gradient(160deg,#145c3f,#1a1a1a)',
    blurb: (e.blurb as string) || '',
    imageUrl: (e.image_url as string) || '',
  }
}

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
  image_url?: string | null
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
    imageUrl: r.image_url || '',
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
      .select('code,host_id,title,subtitle,venue,date_text,sale_at,sale_open,is_featured,max_per_order,fail_chance,image_url')
      .order('is_featured', { ascending: false })
      .order('sale_at', { ascending: true })
    if (error) throw new Error(error.message)
    const events = await Promise.all(
      (data || []).map(async (r) => {
        const { data: areas } = await sb.from('areas').select('total,remaining').eq('room_code', r.code)
        const totalTickets = (areas || []).reduce((s, a) => s + Number(a.total || 0), 0)
        const remaining = (areas || []).reduce((s, a) => s + Number(a.remaining || 0), 0)
        return {
          code: r.code as string,
          hostId: r.host_id as string,
          title: r.title as string,
          subtitle: (r.subtitle as string) || '',
          venue: (r.venue as string) || '',
          dateText: (r.date_text as string) || '',
          saleAt: new Date(r.sale_at as string).getTime(),
          saleOpen: Boolean(r.sale_open),
          featured: Boolean(r.is_featured),
          maxPerOrder: Number(r.max_per_order || 2),
          failChance: Number(r.fail_chance || 0),
          imageUrl: (r.image_url as string) || '',
          totalTickets,
          remaining,
        }
      }),
    )
    return { events }
  },

  async updateRoom(body: Record<string, unknown>) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('update_room_event', {
      p_code: String(body.code || ''),
      p_host_id: body.hostId || null,
      p_title: body.title ?? null,
      p_subtitle: body.subtitle ?? null,
      p_venue: body.venue ?? null,
      p_date_text: body.dateText ?? null,
      p_sale_at: body.saleAt ? new Date(String(body.saleAt)).toISOString() : null,
      p_max_per_order: body.maxPerOrder ?? null,
      p_fail_chance: body.failChance ?? null,
      p_featured: body.featured ?? null,
      p_total_tickets: body.totalTickets ?? null,
      p_image_url: body.imageUrl ?? null,
    })
    if (error) throw new Error(error.message)
    // Fallback if RPC not yet migrated with image_url
    if (body.imageUrl != null) {
      await sb.from('rooms').update({ image_url: String(body.imageUrl) }).eq('code', String(body.code || '').toUpperCase())
    }
    const code = (data as { code?: string })?.code || String(body.code)
    return { room: await loadRoom(code) }
  },

  async adminOpenSale(code: string) {
    const sb = getSupabase()!
    const c = code.toUpperCase()
    const { data: room } = await sb.from('rooms').select('host_id').eq('code', c).single()
    if (!room) throw new Error('找不到房間')
    const { error } = await sb.rpc('open_room_sale', {
      p_code: c,
      p_host_id: room.host_id,
    })
    if (error) throw new Error(error.message)
    return { room: await loadRoom(c) }
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
      title: String(body.title || 'YAWASABI 「SUPER PLANET」 in TAIPEI').slice(0, 80),
      subtitle: String(body.subtitle || '10-city Dome & Stadium Tour 2026-2027').slice(0, 80),
      venue: String(body.venue || 'TAIPEI DOME 台北大巨蛋').slice(0, 80),
      date_text: String(body.dateText || '2026/10/10（六）～10/11（日）').slice(0, 80),
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
      image_url: String(body.imageUrl || ''),
    })
    if (error) throw new Error(error.message)

    const totalTickets = Math.max(0, Number(body.totalTickets || 0))
    const ticketPrice = Math.max(1, Number(body.price || 2800))
    const defaults =
      totalTickets > 0
        ? [
            {
              id: 'general',
              name: '全票區',
              price: ticketPrice,
              total: totalTickets,
              remaining: totalTickets,
              color: '#16a34a',
            },
          ]
        : [
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

  async listDecoys(): Promise<{ events: FakeEvent[] }> {
    const sb = getSupabase()!
    const { data, error } = await sb.from('decoy_events').select('*').order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    const needsSeed =
      !data ||
      data.length === 0 ||
      data.some((row) => !String(row.image_url || '').trim())
    if (needsSeed) {
      const { FAKE_EVENTS } = await import('../data/catalog')
      const rows = FAKE_EVENTS.map((e, i) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        subtitle: e.subtitle,
        category: e.category,
        venue: e.venue,
        date_text: e.dateText,
        price_text: e.priceText,
        status: e.status,
        badge: e.badge || null,
        gradient: e.gradient,
        blurb: e.blurb,
        image_url: e.imageUrl || '',
        sort_order: i,
        updated_at: new Date().toISOString(),
      }))
      const { error: insErr } = await sb.from('decoy_events').upsert(rows)
      if (insErr) throw new Error(insErr.message)
      const { data: seeded, error: again } = await sb
        .from('decoy_events')
        .select('*')
        .order('sort_order', { ascending: true })
      if (again) throw new Error(again.message)
      return { events: (seeded || []).map(mapDecoyRow) }
    }
    return { events: data.map(mapDecoyRow) }
  },

  async upsertDecoy(event: Record<string, unknown>) {
    const sb = getSupabase()!
    const row = {
      id: String(event.id),
      slug: String(event.slug || event.id),
      title: String(event.title || ''),
      subtitle: String(event.subtitle || ''),
      category: String(event.category || 'concert'),
      venue: String(event.venue || ''),
      date_text: String(event.dateText || ''),
      price_text: String(event.priceText || ''),
      status: String(event.status || 'onsale'),
      badge: event.badge ? String(event.badge) : null,
      gradient: String(event.gradient || 'linear-gradient(160deg,#145c3f,#1a1a1a)'),
      blurb: String(event.blurb || ''),
      image_url: String(event.imageUrl || ''),
      sort_order: Number(event.sortOrder || 0),
      updated_at: new Date().toISOString(),
    }
    const { error } = await sb.from('decoy_events').upsert(row)
    if (error) throw new Error(error.message)
    return this.listDecoys()
  },

  async listCards() {
    const sb = getSupabase()!
    const { data, error } = await sb.from('fake_cards').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return {
      cards: (data || []).map((c) => ({
        id: c.id as string,
        label: (c.label as string) || '',
        holder: (c.holder as string) || 'PARTY GUEST',
        cardNumber: c.card_number as string,
        expMonth: c.exp_month as string,
        expYear: c.exp_year as string,
        cvv: c.cvv as string,
        createdAt: new Date(c.created_at as string).getTime(),
      })),
    }
  },

  async createCards(cards: Array<Record<string, string>>) {
    const sb = getSupabase()!
    const rows = cards.map((c) => ({
      label: c.label || '',
      holder: c.holder || 'PARTY GUEST',
      card_number: c.cardNumber,
      exp_month: c.expMonth,
      exp_year: c.expYear,
      cvv: c.cvv,
    }))
    const { error } = await sb.from('fake_cards').insert(rows)
    if (error) throw new Error(error.message)
    return this.listCards()
  },

  async clearCards() {
    const sb = getSupabase()!
    const { error } = await sb.from('fake_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(error.message)
    return this.listCards()
  },

  async validateCard(input: {
    cardNumber: string
    expMonth: string
    expYear: string
    cvv: string
  }) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('validate_fake_card', {
      p_card_number: input.cardNumber,
      p_exp_month: input.expMonth,
      p_exp_year: input.expYear,
      p_cvv: input.cvv,
    })
    if (error) throw new Error(error.message)
    return { ok: Boolean(data) }
  },
}
