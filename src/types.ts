export type TicketArea = {
  id: string
  name: string
  price: number
  total: number
  remaining: number
  color: string
  soldOut?: boolean
}

export type Order = {
  id: string
  nickname: string
  areaName: string
  qty: number
  seats: string[]
  code: string
  createdAt: number
}

export type Room = {
  code: string
  title: string
  subtitle: string
  venue: string
  dateText: string
  saleAt: number
  saleOpen: boolean
  maxPerOrder: number
  queueDelayMs: number
  failChance: number
  areas: TicketArea[]
  playerCount: number
  orderCount: number
  notices: string[]
  orders: Order[]
}

export type Session = {
  code: string
  playerId: string
  nickname: string
  isHost: boolean
  hostId?: string
}
