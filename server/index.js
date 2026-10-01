import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { networkInterfaces } from 'os'
import { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'
import { configureAreas, selectForPurchase } from './seats.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

/** @typedef {{ id: string, name: string, price: number, total: number, remaining: number, color: string }} TicketArea */
/** @typedef {{ id: string, nickname: string, isHost: boolean }} Player */
/** @typedef {{ id: string, playerId: string, nickname: string, areaId: string, areaName: string, qty: number, seats: string[], code: string, createdAt: number }} Order */
/** @typedef {{
 *  code: string,
 *  hostId: string,
 *  title: string,
 *  subtitle: string,
 *  venue: string,
 *  dateText: string,
 *  saleAt: number,
 *  saleOpen: boolean,
 *  maxPerOrder: number,
 *  queueDelayMs: number,
 *  failChance: number,
 *  areas: TicketArea[],
 *  players: Player[],
 *  orders: Order[],
 *  notices: string[],
 *  createdAt: number,
 * }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map()

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const roomSockets = new Map()

/** Featured homepage party room code */
let featuredCode = 'PARTY0'

function createRoomObject(body = {}, { code, hostId, hostName } = {}) {
  const saleInSec = Number(body.saleInSec ?? 120)
  const resolvedHostId = hostId || randomUUID()
  const resolvedHostName = String(hostName || body.hostName || '主辦人').slice(0, 20)
  const saleAt = body.saleAt ? new Date(body.saleAt).getTime() : Date.now() + Math.max(5, saleInSec) * 1000
  /** @type {Room} */
  const room = {
    code,
    hostId: resolvedHostId,
    title: String(body.title || 'YAWASABI 「SUPER PLANET」 in TAIPEI').slice(0, 80),
    subtitle: String(body.subtitle || '10-city Dome & Stadium Tour 2026-2027').slice(0, 80),
    venue: String(body.venue || 'TAIPEI DOME 台北大巨蛋').slice(0, 80),
    dateText: String(body.dateText || '2026/10/10（六）～10/11（日）').slice(0, 80),
    saleAt: Number.isFinite(saleAt) ? saleAt : Date.now() + Math.max(5, saleInSec) * 1000,
    saleOpen: false,
    maxPerOrder: Math.min(4, Math.max(1, Number(body.maxPerOrder || 2))),
    queueDelayMs: Math.min(8000, Math.max(800, Number(body.queueDelayMs || 2500))),
    failChance: Math.min(0.6, Math.max(0, Number(body.failChance ?? 0.15))),
    imageUrl: String(body.imageUrl || ''),
    areas: Array.isArray(body.areas) && body.areas.length
      ? body.areas.map((a, i) => ({
          id: String(a.id || `area-${i}`),
          name: String(a.name || `票區 ${i + 1}`),
          price: Number(a.price || 1000),
          total: Math.min(999,Math.max(1,Number(a.total || 10))),
          remaining: Math.min(999,Math.max(1,Number(a.total || 10))),
          color: String(a.color || '#16a34a'),
        }))
      : defaultAreas(),
    players: [{ id: resolvedHostId, nickname: resolvedHostName, isHost: true }],
    orders: [],
    notices: [
      '本系統為派對娛樂用假搶票，一切票券皆為假的，沒有真實效力。',
      '為避免開賣時「登入逾時」，請於開賣前重新整理頁面確認連線狀態。',
      '每筆訂單限購張數以主辦設定為準。流量控管中請耐心等候。',
      '首頁其他活動皆為裝飾用假頁，僅本場可購票。',
    ],
    createdAt: Date.now(),
  }
  configureAreas(room, room.areas.map(a => ({...a,realSeats:a.total,fakeSeats:0})))
  return room
}

function yawasabiDefaults() {
  return {
    title: 'YAWASABI 「SUPER PLANET」 in TAIPEI',
    subtitle: '10-city Dome & Stadium Tour 2026-2027',
    venue: 'TAIPEI DOME 台北大巨蛋',
    dateText: '2026/10/10（六）～10/11（日）',
    imageUrl: '/events/yawasabi-super-planet.jpg',
    saleAt: new Date('2026-10-10T10:00:00+08:00').toISOString(),
    failChance: 0.15,
    maxPerOrder: 2,
    areas: [
      { id: 'vip', name: 'VIP 搖滾區', price: 6800, total: 6, color: '#e11d48' },
      { id: 'a', name: '特 A 區', price: 4800, total: 10, color: '#ea580c' },
      { id: 'b', name: '特 B 區', price: 3800, total: 14, color: '#ca8a04' },
      { id: 'c', name: '二樓座席', price: 2800, total: 20, color: '#16a34a' },
    ],
  }
}

function ensureFeaturedRoom() {
  return rooms.get(featuredCode) || rooms.values().next().value
}

function codeGen() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function defaultAreas() {
  return [
    { id: 'vip', name: 'VIP 搖滾區', price: 5800, total: 4, remaining: 4, color: '#e11d48' },
    { id: 'a', name: '特 A 區', price: 4800, total: 8, remaining: 8, color: '#ea580c' },
    { id: 'b', name: '特 B 區', price: 3800, total: 12, remaining: 12, color: '#ca8a04' },
    { id: 'c', name: '二樓座席', price: 2800, total: 16, remaining: 16, color: '#16a34a' },
  ]
}

function publicRoom(room) {
  return {
    code: room.code,
    title: room.title,
    subtitle: room.subtitle,
    venue: room.venue,
    dateText: room.dateText,
    saleAt: room.saleAt,
    saleOpen: room.saleOpen || Date.now() >= room.saleAt,
    maxPerOrder: room.maxPerOrder,
    queueDelayMs: room.queueDelayMs,
    failChance: room.failChance,
    imageUrl: room.imageUrl || '',
    seats: room.seats.map(s => ({id:s.id,areaId:s.areaId,position:s.position,label:s.label,sold:s.sold})),
    areas: room.areas.map((a) => ({
      id: a.id,
      name: a.name,
      price: a.price,
      total: a.total,
      remaining: a.remaining,
      color: a.color,
      soldOut: a.remaining <= 0,
    })),
    playerCount: room.players.length,
    orderCount: room.orders.length,
    notices: room.notices,
    orders: room.orders.map((o) => ({
      id: o.id,
      unitPrice: o.unitPrice,
      nickname: o.nickname,
      areaName: o.areaName,
      qty: o.qty,
      seats: o.seats,
      code: o.code,
      createdAt: o.createdAt,
    })),
  }
}

function broadcast(code, payload) {
  const set = roomSockets.get(code)
  if (!set) return
  const msg = JSON.stringify(payload)
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

function pushRoom(code) {
  const room = rooms.get(code)
  if (!room) return
  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  broadcast(code, { type: 'room', room: publicRoom(room) })
}

const app = express()
app.use(cors())
app.use(express.json({limit:'2mb'}))

rooms.set(featuredCode,createRoomObject(yawasabiDefaults(),{code:featuredCode,hostName:'系統'}))
rooms.set('BBQ1011',createRoomObject({title:'下班烤肉派對',subtitle:'好朋友限定・屋頂炭火之夜',venue:'屋頂派對主場',dateText:'2026/10/11（日）16:00',saleAt:'2026-10-10T10:00:00+08:00',imageUrl:'/events/bbq-party.jpg',failChance:0,maxPerOrder:1},{code:'BBQ1011',hostName:'主辦'}))
configureAreas(rooms.get('BBQ1011'),[{id:'general',name:'烤肉席',price:700,realSeats:18,fakeSeats:18,color:'#16a34a'}])

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, featuredCode })
})

app.get('/api/featured', (_req, res) => {
  const room = ensureFeaturedRoom()
  if (!room) return res.status(404).json({error:'目前沒有活動'})
  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  res.json({ room: publicRoom(room), hostHint: 'POST /api/featured/claim-host' })
})

app.get('/api/events', (_req, res) => {
  ensureFeaturedRoom()
  const events = [...rooms.values()]
    .map((r) => ({
      code: r.code,
      hostId: r.hostId,
      title: r.title,
      subtitle: r.subtitle,
      venue: r.venue,
      dateText: r.dateText,
      saleAt: r.saleAt,
      saleOpen: r.saleOpen || Date.now() >= r.saleAt,
      featured: r.code === featuredCode,
      maxPerOrder: r.maxPerOrder,
      failChance: r.failChance,
      imageUrl: r.imageUrl || '',
      areas: r.areas,
      totalTickets: r.areas.reduce((s, a) => s + a.total, 0),
      remaining: r.areas.reduce((s, a) => s + a.remaining, 0),
    }))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.saleAt - b.saleAt)
  res.json({ events })
})

app.post('/api/featured/claim-host', (req, res) => {
  const room = ensureFeaturedRoom()
  if (!room) return res.status(404).json({error:'目前沒有活動'})
  const nickname = String(req.body?.nickname || '主辦人').slice(0, 20)
  const hostId = randomUUID()
  room.hostId = hostId
  room.players = room.players.filter((p) => !p.isHost)
  room.players.unshift({ id: hostId, nickname, isHost: true })
  pushRoom(room.code)
  res.json({ hostId, room: publicRoom(room) })
})

app.post('/api/rooms', (req, res) => {
  const body = req.body || {}
  let code = codeGen()
  while (rooms.has(code) || code === featuredCode) code = codeGen()
  const hostId = randomUUID()
  const hostName = String(body.hostName || '主辦人').slice(0, 20)
  const room = createRoomObject(body, { code, hostId, hostName })
  try { configureAreas(room,body.areas || (body.totalTickets ? [{id:'general',name:'全票區',price:Number(body.price ?? 700),realSeats:Number(body.totalTickets),fakeSeats:Number(body.fakeSeats ?? 0),color:'#16a34a'}] : room.areas.map(a => ({...a,realSeats:a.total,fakeSeats:0})))) }
  catch (err) {return res.status(400).json({error:err.message})}
  if (body.featured) {
    featuredCode = code
  }
  rooms.set(code, room)
  res.json({ hostId, room: publicRoom(room) })
})

app.patch('/api/rooms/:code', (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })
  const body = req.body || {}
  if (body.hostId !== room.hostId) return res.status(403).json({error:'只有主辦可以編輯'})
  try { if (body.areas) configureAreas(room,body.areas) }
  catch (err) {return res.status(400).json({error:err.message})}
  if (body.title) room.title = String(body.title).slice(0, 80)
  if (body.subtitle != null) room.subtitle = String(body.subtitle).slice(0, 80)
  if (body.venue != null) room.venue = String(body.venue).slice(0, 80)
  if (body.dateText != null) room.dateText = String(body.dateText).slice(0, 80)
  if (body.saleAt) {
    const t = new Date(body.saleAt).getTime()
    if (Number.isFinite(t)) {
      room.saleAt = t
      if (t > Date.now()) room.saleOpen = false
    }
  }
  if (body.maxPerOrder != null) room.maxPerOrder = Math.min(4, Math.max(1, Number(body.maxPerOrder)))
  if (body.failChance != null) room.failChance = Math.min(0.6, Math.max(0, Number(body.failChance)))
  if (body.imageUrl != null) room.imageUrl = String(body.imageUrl)
  if (body.featured) featuredCode = code
  if (body.featured === false && featuredCode === code) featuredCode = ''
  pushRoom(code)
  res.json({ room: publicRoom(room) })
})

app.delete('/api/rooms/:code', (req,res) => {
  const code=String(req.params.code).toUpperCase(); const room=rooms.get(code)
  if (!room) return res.status(404).json({error:'找不到活動'})
  if (req.body?.hostId !== room.hostId) return res.status(403).json({error:'只有主辦可以刪除'})
  rooms.delete(code)
  for (const ws of roomSockets.get(code) || []) ws.close()
  roomSockets.delete(code)
  if (featuredCode === code) featuredCode=''
  res.json({ok:true})
})

app.post('/api/rooms/:code/admin-open', (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })
  room.saleOpen = true
  room.saleAt = Date.now()
  pushRoom(code)
  res.json({ room: publicRoom(room) })
})

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(String(req.params.code).toUpperCase())
  if (!room) return res.status(404).json({ error: '找不到房間' })
  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  res.json({ room: publicRoom(room) })
})

app.post('/api/rooms/:code/join', (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })

  const nickname = String(req.body?.nickname || '訪客').slice(0, 20)
  const playerId = randomUUID()
  room.players.push({ id: playerId, nickname, isHost: false })
  pushRoom(code)
  res.json({ playerId, room: publicRoom(room) })
})

app.post('/api/rooms/:code/open', (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })
  if (req.body?.hostId !== room.hostId) return res.status(403).json({ error: '只有主辦可以開賣' })
  room.saleOpen = true
  room.saleAt = Date.now()
  pushRoom(code)
  res.json({ room: publicRoom(room) })
})

app.post('/api/rooms/:code/reset-stock', (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })
  if (req.body?.hostId !== room.hostId) return res.status(403).json({ error: '只有主辦可以重置' })
  for (const a of room.areas) a.remaining = a.total
  for (const seat of room.seats) seat.sold=false
  room.orders = []
  room.saleOpen = false
  room.saleAt = Date.now() + Math.max(5, Number(req.body?.saleInSec || 20)) * 1000
  pushRoom(code)
  res.json({ room: publicRoom(room) })
})

app.post('/api/rooms/:code/purchase', async (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const room = rooms.get(code)
  if (!room) return res.status(404).json({ error: '找不到房間' })

  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  if (!room.saleOpen) return res.status(400).json({ error: '尚未開賣', code: 'NOT_OPEN' })

  const { playerId, areaId, qty, nickname, seatIds } = req.body || {}
  const area = room.areas.find((a) => a.id === areaId)
  if (!area) return res.status(400).json({ error: '票區不存在' })

  const n = Number(qty)
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return res.status(400).json({error:'請先加入活動'})
  let selectedSeats
  try { selectedSeats=selectForPurchase(room,areaId,seatIds,n) }
  catch (err) {return res.status(409).json({error:err.message,code:err.code})}
  const name = String(nickname || player?.nickname || '訪客').slice(0, 20)

  // Fake queue processing delay is handled client-side; server still may "fail"
  if (Math.random() < room.failChance) {
    return res.status(409).json({
      error: '目前購票人數過多，系統忙碌中，請重新再試',
      code: 'BUSY',
    })
  }

  if (area.remaining < n) {
    pushRoom(code)
    return res.status(409).json({
      error: area.remaining <= 0 ? '該票區已售完' : `剩餘座位不足（剩 ${area.remaining}）`,
      code: 'SOLD_OUT',
      remaining: area.remaining,
    })
  }

  area.remaining -= n
  selectedSeats.forEach(s => {s.sold=true})
  const seats = selectedSeats.sort((a,b) => a.position-b.position).map(s => s.label)
  const orderCode = `P${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`

  /** @type {Order} */
  const order = {
    id: randomUUID(),
    playerId: String(playerId || ''),
    nickname: name,
    areaId: area.id,
    areaName: area.name,
    qty: n,
    unitPrice: area.price,
    seats,
    code: orderCode,
    createdAt: Date.now(),
  }
  room.orders.unshift(order)
  pushRoom(code)
  res.json({ order, room: publicRoom(room) })
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const code = String(url.searchParams.get('code') || '').toUpperCase()
  if (!code || !rooms.has(code)) {
    ws.close()
    return
  }
  if (!roomSockets.has(code)) roomSockets.set(code, new Set())
  roomSockets.get(code).add(ws)
  const room = rooms.get(code)
  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  ws.send(JSON.stringify({ type: 'room', room: publicRoom(room) }))

  ws.on('close', () => {
    roomSockets.get(code)?.delete(ws)
  })
})

// Serve built frontend when dist exists
const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next()
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next()
  })
})

setInterval(() => {
  for (const [code, room] of rooms) {
    if (!room.saleOpen && Date.now() >= room.saleAt) {
      room.saleOpen = true
      pushRoom(code)
    }
  }
}, 500)

function lanUrls(port) {
  let nets
  try {nets=networkInterfaces()} catch {return []}
  const urls = []
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`)
      }
    }
  }
  return urls
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('pbon 派對售票已啟動')
  console.log(`本機: http://localhost:${PORT}`)
  const urls = lanUrls(PORT)
  if (urls.length) {
    console.log('手機請連同一 Wi‑Fi，用下面網址（或掃主辦頁 QR）：')
    for (const u of urls) console.log(`  ${u}`)
  } else {
    console.log('找不到區網 IP，請在系統網路設定查看。')
  }
  console.log('')
})
