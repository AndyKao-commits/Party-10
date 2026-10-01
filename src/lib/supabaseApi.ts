import type { FakeEvent } from '../data/catalog'
import type { Order, Room, TicketArea, Seat } from '../types'
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
  unit_price?: number
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
    unitPrice: o.unit_price,
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

  const { data: seats, error: seatError } = await sb.rpc('list_ticket_seats', { p_code: c })
  if (seatError) throw new Error('座位資料載入失敗：' + seatError.message)
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
    seats: (seats || []) as Seat[],
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
  if (msg.includes('你是黃牛')) e.code = 'FAKE_SEAT'
  else if (msg.includes('已被購買')) e.code = 'SEAT_TAKEN'
  else if (msg.includes('尚未開賣')) e.code = 'NOT_OPEN'
  else if (msg.includes('忙碌') || msg.includes('過多')) e.code = 'BUSY'
  else if (msg.includes('售完') || msg.includes('不足')) e.code = 'SOLD_OUT'
  return e
}

export const supabaseApi = {
  async listPurchaseRecords() {
    const sb=getSupabase()!
    const [{data: orders,error},{data: rooms,error: roomError}] = await Promise.all([
      sb.from('orders').select('id,room_code,nickname,area_name,qty,seats,code,created_at,unit_price').order('created_at',{ascending:false}),
      sb.from('rooms').select('code,title'),
    ])
    if(error || roomError) throw new Error(error?.message || roomError?.message)
    const titles=new Map((rooms || []).map(r => [r.code,r.title]))
    return {orders:(orders || []).map(o => ({...mapOrders([o as OrderRow])[0],eventCode:o.room_code as string,eventTitle:String(titles.get(o.room_code) || o.room_code)}))}
  },
  async cancelPurchaseRecord(orderId: string, hostId: string) {
    const { error } = await getSupabase()!.rpc('cancel_ticket_order', {
      p_order_id: orderId,
      p_host_id: hostId,
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  },
  async clearPurchaseRecords(code: string, hostId: string) {
    const { data, error } = await getSupabase()!.rpc('clear_ticket_orders', {
      p_code: code,
      p_host_id: hostId,
    })
    if (error) throw new Error(error.message)
    return { removed: Number(data || 0) }
  },
  async getFeatured() {
    const sb = getSupabase()!
    const { data: featured, error: fErr } = await sb
      .from('rooms')
      .select('code')
      .order('is_featured', {ascending:false})
      .order('created_at', {ascending:true})
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
    const { data, error } = await sb
      .from('rooms')
      .select('code,host_id,title,subtitle,venue,date_text,sale_at,sale_open,is_featured,max_per_order,fail_chance,image_url')
      .order('is_featured', { ascending: false })
      .order('sale_at', { ascending: true })
    if (error) throw new Error(error.message)
    const events = await Promise.all(
      (data || []).map(async (r) => {
        const { data: areas } = await sb.from('areas').select('*').eq('room_code', r.code)
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
          areas: (areas || []).map(a => ({...a,realSeats:Number(a.real_seats ?? a.total),fakeSeats:Number(a.fake_seats ?? 0)})),
          totalTickets,
          remaining,
        }
      }),
    )
    return { events }
  },

  async updateRoom(body: Record<string, unknown>) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('save_ticket_event', { p_code: String(body.code || ''), p_host_id: body.hostId, p_event: body, p_areas: body.areas })
    if (error) throw new Error(error.message)
    return { room: await loadRoom(String(data)) }
  },

  async deleteRoom(code: string, hostId: string) {
    const { error } = await getSupabase()!.rpc('delete_ticket_event', { p_code: code, p_host_id: hostId })
    if (error) throw new Error(error.message)
    return { ok: true }
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
    const hostId = crypto.randomUUID()
    const code = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
    const defaults = [{id:'general',name:'全票區',price:Number(body.price ?? 700),realSeats:Number(body.totalTickets ?? 18),fakeSeats:0,color:'#16a34a'}]
    const event = {...body,saleAt:body.saleAt || new Date(Date.now() + Number(body.saleInSec ?? 30)*1000).toISOString()}
    const { error } = await getSupabase()!.rpc('save_ticket_event', { p_code: code, p_host_id: hostId, p_event: event, p_areas: body.areas || defaults })
    if (error) throw new Error(error.message)
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
    body: { playerId: string; areaId: string; qty: number; nickname: string; seatIds?: string[] },
  ) {
    const sb = getSupabase()!
    const { data, error } = await sb.rpc('purchase_selected_seats', {
      p_code: code,
      p_player_id: body.playerId || null,
      p_area_id: body.areaId,
      p_qty: body.qty,
      p_nickname: body.nickname,
      p_seat_ids: body.seatIds || [],
    })
    if (error) throw rpcError(error)
    const order = (data as { order: Order }).order
    return { order, room: await loadRoom(code) }
  },

  subscribeRoom(code: string, onRoom: (room: Room) => void) {
    const sb = getSupabase()!
    const c = code.toUpperCase()
    let alive = true
    let refreshTimer: number | undefined
    let refreshing = false
    let refreshAgain = false
    const refresh = async () => {
      if (refreshing) {
        refreshAgain = true
        return
      }
      refreshing = true
      try {
        if (!alive) return
        onRoom(await loadRoom(c))
      } catch {
        /* ignore transient */
      } finally {
        refreshing = false
        if (alive && refreshAgain) {
          refreshAgain = false
          scheduleRefresh()
        }
      }
    }
    // One purchase emits both area and order changes. During a rush, every
    // connected phone receives many events at once, so collapse the burst
    // into one snapshot request instead of refetching for every row change.
    const scheduleRefresh = () => {
      if (!alive) return
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => void refresh(), 350)
    }
    const channel = sb
      .channel(`room-${c}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${c}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas', filter: `room_code=eq.${c}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `room_code=eq.${c}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${c}` }, scheduleRefresh)
      .subscribe()
    void refresh()
    return () => {
      alive = false
      window.clearTimeout(refreshTimer)
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
