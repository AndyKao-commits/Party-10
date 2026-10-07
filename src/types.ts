export type TicketArea = {
  id: string
  name: string
  price: number
  total: number
  remaining: number
  color: string
  soldOut?: boolean
  ticketContent?: string
}

export type Order = {
  unitPrice?: number
  id: string
  nickname: string
  areaName: string
  qty: number
  seats: string[]
  code: string
  createdAt: number
}

export type TicketLookupOrder = {
  id: string
  eventCode: string
  eventTitle: string
  eventDate: string
  eventImage?: string
  buyerName: string
  areaName: string
  qty: number
  unitPrice?: number
  orderCode: string
  createdAt: number
  pickedUpAt?: number | null
  ticketContent: string
  tickets: { seat: string; ticketCode: string }[]
}

export type Seat = { id: string; areaId: string; label: string; position: number; sold: boolean }

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
  imageUrl?: string
  seats: Seat[]
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

export type PartyMember = { id: string; name: string; phone: string; account: string; createdAt: number; orderCount?: number }
export type SiteStatus = {
  siteOpen: boolean
  effectiveOpen: boolean
  registrationOpen: boolean
  purchaseOpen: boolean
  closedMessage: string
  staffAccess: boolean
  member: PartyMember | null
}
