import type { FakeCard } from './cards'

const WIDTH = 1400
const HEIGHT = 560
const CARD_W = 660
const CARD_H = 416
const A4_W = 2480
const A4_H = 3508
const PRINT_CARD_W = 1011 // 85.6 mm at 300 dpi
const PRINT_SCALE = PRINT_CARD_W / CARD_W
const PRINT_CARD_H = Math.round(CARD_H * PRINT_SCALE) // 53.98 mm at 300 dpi
const CARDS_PER_A4 = 8

function brandFor(card: FakeCard) {
  return card.cardNumber.replace(/\D/g, '').startsWith('5') ? 'MASTERCARD' : 'VISA'
}

function colorsFor(card: FakeCard) {
  const palettes = [
    ['#071c34', '#075985', '#22c55e'],
    ['#2b0a3d', '#7e22ce', '#ec4899'],
    ['#161616', '#3f3f46', '#c8a85a'],
    ['#052e2b', '#0f766e', '#38bdf8'],
  ]
  const n = card.cardNumber.replace(/\D/g, '').split('').reduce((sum, digit) => sum + Number(digit), 0)
  return palettes[n % palettes.length]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawCardBase(ctx: CanvasRenderingContext2D, card: FakeCard, x: number, y: number) {
  const [a, b, accent] = colorsFor(card)
  ctx.save()
  roundRect(ctx, x, y, CARD_W, CARD_H, 34)
  ctx.clip()
  const gradient = ctx.createLinearGradient(x, y, x + CARD_W, y + CARD_H)
  gradient.addColorStop(0, a)
  gradient.addColorStop(0.58, b)
  gradient.addColorStop(1, '#09090b')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, CARD_W, CARD_H)
  ctx.globalAlpha = 0.18
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(x + CARD_W - 80, y + 30, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 80, y + CARD_H + 30, 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#d9b85e'
  roundRect(ctx, x, y, 92, 68, 12)
  ctx.fill()
  ctx.strokeStyle = '#8c7130'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 31, y)
  ctx.lineTo(x + 31, y + 68)
  ctx.moveTo(x + 61, y)
  ctx.lineTo(x + 61, y + 68)
  ctx.moveTo(x, y + 34)
  ctx.lineTo(x + 92, y + 34)
  ctx.stroke()
}

function drawFront(ctx: CanvasRenderingContext2D, card: FakeCard, x: number, y: number) {
  drawCardBase(ctx, card, x, y)
  ctx.fillStyle = '#fff'
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillText('PARTY BANK', x + 38, y + 50)
  ctx.textAlign = 'right'
  ctx.font = 'italic 800 30px system-ui, sans-serif'
  ctx.fillText(brandFor(card), x + CARD_W - 38, y + 52)
  ctx.textAlign = 'left'
  drawChip(ctx, x + 42, y + 92)
  ctx.font = '500 35px ui-monospace, monospace'
  ctx.letterSpacing = '4px'
  ctx.fillText(card.cardNumber, x + 42, y + 228)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.fillText('CARD HOLDER', x + 42, y + 296)
  ctx.fillText('VALID THRU', x + 410, y + 296)
  ctx.fillStyle = '#fff'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.fillText(card.holder.toUpperCase(), x + 42, y + 330)
  ctx.fillText(`${card.expMonth}/${card.expYear}`, x + 410, y + 330)
  ctx.globalAlpha = 0.62
  ctx.font = '800 21px system-ui, sans-serif'
  ctx.fillText('DEMO • NOT VALID', x + 42, y + 382)
  ctx.globalAlpha = 1
}

function drawBack(ctx: CanvasRenderingContext2D, card: FakeCard, x: number, y: number) {
  drawCardBase(ctx, card, x, y)
  ctx.fillStyle = '#050505'
  ctx.fillRect(x, y + 62, CARD_W, 88)
  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(x + 38, y + 190, 465, 58)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 503, y + 190, 105, 58)
  ctx.fillStyle = '#18181b'
  ctx.textAlign = 'center'
  ctx.font = 'italic 700 23px ui-monospace, monospace'
  ctx.fillText(card.cvv, x + 555, y + 228)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,.82)'
  ctx.font = '500 14px system-ui, sans-serif'
  ctx.fillText('AUTHORIZED SIGNATURE', x + 38, y + 180)
  ctx.fillText('此卡僅供私人派對遊戲使用，無付款功能。', x + 38, y + 294)
  ctx.fillText(`識別：${card.label || card.holder}`, x + 38, y + 326)
  ctx.fillStyle = '#fff'
  ctx.font = '800 23px system-ui, sans-serif'
  ctx.fillText('PARTY BANK', x + 38, y + 380)
  ctx.textAlign = 'right'
  ctx.fillText('DEMO • NOT VALID', x + CARD_W - 38, y + 380)
  ctx.textAlign = 'left'
}

async function renderCard(card: FakeCard) {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('此瀏覽器無法輸出圖片')
  ctx.fillStyle = '#eef2f1'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawFront(ctx, card, 30, 72)
  drawBack(ctx, card, 710, 72)
  ctx.fillStyle = '#334155'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('正面', 30, 48)
  ctx.fillText('背面', 710, 48)
  return canvas
}

function printPositions() {
  const gapX = (A4_W - PRINT_CARD_W * 2) / 3
  const gapY = (A4_H - PRINT_CARD_H * 4) / 5
  return Array.from({ length: CARDS_PER_A4 }, (_, index) => ({
    x: Math.round(gapX + (index % 2) * (PRINT_CARD_W + gapX)),
    y: Math.round(gapY + Math.floor(index / 2) * (PRINT_CARD_H + gapY)),
  }))
}

function drawCropMarks(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const mark = 24
  const inset = 8
  ctx.save()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - mark, y); ctx.lineTo(x - inset, y)
  ctx.moveTo(x, y - mark); ctx.lineTo(x, y - inset)
  ctx.moveTo(x + PRINT_CARD_W + inset, y); ctx.lineTo(x + PRINT_CARD_W + mark, y)
  ctx.moveTo(x + PRINT_CARD_W, y - mark); ctx.lineTo(x + PRINT_CARD_W, y - inset)
  ctx.moveTo(x - mark, y + PRINT_CARD_H); ctx.lineTo(x - inset, y + PRINT_CARD_H)
  ctx.moveTo(x, y + PRINT_CARD_H + inset); ctx.lineTo(x, y + PRINT_CARD_H + mark)
  ctx.moveTo(x + PRINT_CARD_W + inset, y + PRINT_CARD_H); ctx.lineTo(x + PRINT_CARD_W + mark, y + PRINT_CARD_H)
  ctx.moveTo(x + PRINT_CARD_W, y + PRINT_CARD_H + inset); ctx.lineTo(x + PRINT_CARD_W, y + PRINT_CARD_H + mark)
  ctx.stroke()
  ctx.restore()
}

async function renderA4Page(cards: FakeCard[], side: 'front' | 'back') {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = A4_W
  canvas.height = A4_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('此瀏覽器無法輸出圖片')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, A4_W, A4_H)
  const positions = printPositions()
  cards.forEach((card, index) => {
    const frontPosition = positions[index]
    // Mirror the back horizontally so long-edge duplex printing lines up.
    const x = side === 'back' ? A4_W - frontPosition.x - PRINT_CARD_W : frontPosition.x
    const y = frontPosition.y
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(PRINT_SCALE, PRINT_SCALE)
    if (side === 'front') drawFront(ctx, card, 0, 0)
    else drawBack(ctx, card, 0, 0)
    ctx.restore()
    drawCropMarks(ctx, x, y)
  })
  return canvas
}

function safeName(value: string) {
  return (value || 'party-card').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 50) || 'party-card'
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片輸出失敗'))), 'image/png'),
  )
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipImages(files: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const write16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true)
  const write32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true)

  for (const file of files) {
    const name = encoder.encode(file.name)
    const checksum = crc32(file.data)
    const local = new Uint8Array(30 + name.length + file.data.length)
    const lv = new DataView(local.buffer)
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0x0800)
    write16(lv, 8, 0); write16(lv, 10, time); write16(lv, 12, date); write32(lv, 14, checksum)
    write32(lv, 18, file.data.length); write32(lv, 22, file.data.length); write16(lv, 26, name.length)
    local.set(name, 30); local.set(file.data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20); write16(cv, 8, 0x0800)
    write16(cv, 10, 0); write16(cv, 12, time); write16(cv, 14, date); write32(cv, 16, checksum)
    write32(cv, 20, file.data.length); write32(cv, 24, file.data.length); write16(cv, 28, name.length)
    write32(cv, 42, offset); central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  write32(ev, 0, 0x06054b50); write16(ev, 8, files.length); write16(ev, 10, files.length)
  write32(ev, 12, centralSize); write32(ev, 16, offset)
  const result = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) { result.set(part, cursor); cursor += part.length }
  return result
}

export async function exportCardImage(card: FakeCard) {
  const blob = await canvasBlob(await renderCard(card))
  download(blob, `${safeName(card.label || card.holder)}-信用卡正反面.png`)
}

export async function exportAllCardImages(cards: FakeCard[]) {
  if (!cards.length) throw new Error('目前沒有可匯出的假卡')
  const files: Array<{ name: string; data: Uint8Array }> = []
  const pageCount = Math.ceil(cards.length / CARDS_PER_A4)
  for (let page = 0; page < pageCount; page++) {
    const pageCards = cards.slice(page * CARDS_PER_A4, (page + 1) * CARDS_PER_A4)
    for (const side of ['front', 'back'] as const) {
      const blob = await canvasBlob(await renderA4Page(pageCards, side))
      const sideLabel = side === 'front' ? '正面' : '背面-雙面列印對位'
      const name = `A4-${String(page + 1).padStart(2, '0')}-${sideLabel}.png`
      files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) })
    }
  }
  const zip = zipImages(files)
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `派對假卡-A4列印版-${cards.length}張.zip`)
}
