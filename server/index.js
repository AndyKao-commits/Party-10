import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { networkInterfaces } from 'os'
import { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'
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
  /** @type {Room} */
  const room = {
    code,
    hostId: resolvedHostId,
    title: String(body.title || 'PARTY HOUSE 2026 小派對 WORLD TOUR').slice(0, 80),
    subtitle: String(body.subtitle || '＜FUN ONLY＞ in LIVING ROOM').slice(0, 80),
    venue: String(body.venue || '你家客廳・派對主舞台').slice(0, 80),
    dateText: String(body.dateText || '今晚・派對開演').slice(0, 80),
    saleAt: Date.now() + Math.max(5, saleInSec) * 1000,
    saleOpen: false,
    maxPerOrder: Math.min(4, Math.max(1, Number(body.maxPerOrder || 2))),
    queueDelayMs: Math.min(8000, Math.max(800, Number(body.queueDelayMs || 2500))),
    failChance: Math.min(0.6, Math.max(0, Number(body.failChance ?? 0.15))),
    areas: Array.isArray(body.areas) && body.areas.length
      ? body.areas.map((a, i) => ({
          id: String(a.id || `area-${i}`),
          name: String(a.name || `票區 ${i + 1}`),
          price: Number(a.price || 1000),
          total: Number(a.total || 10),
          remaining: Number(a.total || 10),
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
  return room
}

function ensureFeaturedRoom() {
  featuredCode = String(process.env.FEATURED_CODE || 'PARTY0').toUpperCase()
  if (!rooms.has(featuredCode)) {
    const room = createRoomObject(
      {
        saleInSec: 365 * 24 * 3600,
        failChance: 0.12,
        maxPerOrder: 2,
      },
      { code: featuredCode, hostName: '系統' },
    )
    room.saleOpen = false
    rooms.set(featuredCode, room)
  }
  return rooms.get(featuredCode)
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
app.use(express.json())

ensureFeaturedRoom()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, featuredCode })
})

app.get('/api/featured', (_req, res) => {
  const room = ensureFeaturedRoom()
  room.saleOpen = room.saleOpen || Date.now() >= room.saleAt
  res.json({ room: publicRoom(room), hostHint: 'POST /api/featured/claim-host' })
})

app.post('/api/featured/claim-host', (req, res) => {
  const room = ensureFeaturedRoom()
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
  rooms.set(code, room)
  res.json({ hostId, room: publicRoom(room) })
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

  const { playerId, areaId, qty, nickname } = req.body || {}
  const area = room.areas.find((a) => a.id === areaId)
  if (!area) return res.status(400).json({ error: '票區不存在' })

  const n = Math.min(room.maxPerOrder, Math.max(1, Number(qty || 1)))
  const player = room.players.find((p) => p.id === playerId)
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
  const row = String.fromCharCode(65 + Math.floor(Math.random() * 8))
  const start = 1 + Math.floor(Math.random() * 20)
  const seats = Array.from({ length: n }, (_, i) => `${row}排${start + i}號`)
  const orderCode = `P${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`

  /** @type {Order} */
  const order = {
    id: randomUUID(),
    playerId: String(playerId || ''),
    nickname: name,
    areaId: area.id,
    areaName: area.name,
    qty: n,
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
  const nets = networkInterfaces()
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
