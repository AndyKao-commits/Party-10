import { zipSync } from 'fflate'
import type { FakeCard } from './cards'

const WIDTH = 1400
const HEIGHT = 560
const CARD_W = 660
const CARD_H = 416

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

export async function exportCardImage(card: FakeCard) {
  const blob = await canvasBlob(await renderCard(card))
  download(blob, `${safeName(card.label || card.holder)}-信用卡正反面.png`)
}

export async function exportAllCardImages(cards: FakeCard[]) {
  if (!cards.length) throw new Error('目前沒有可匯出的假卡')
  const files: Record<string, Uint8Array> = {}
  for (let i = 0; i < cards.length; i++) {
    const blob = await canvasBlob(await renderCard(cards[i]))
    const name = `${String(i + 1).padStart(2, '0')}-${safeName(cards[i].label || cards[i].holder)}.png`
    files[name] = new Uint8Array(await blob.arrayBuffer())
  }
  const zip = zipSync(files, { level: 0 })
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `派對假卡-${cards.length}張.zip`)
}
