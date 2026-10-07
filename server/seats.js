import { randomUUID, randomInt } from 'node:crypto'

export const FAKE_SEAT_WARNINGS = [
  '你是黃牛不讓你買，請重新選位',
  '此座位已被其他人搶先購買',
  '此座位已被神秘嘉賓預留',
  '系統偵測到可疑手速，本席暫不出售',
  '這個位置已經有主人了，換一個吧',
  '很抱歉，你與這個座位緣分未到',
  '此座位正在裝忙，暫時不接客',
  '手速很快，但命運更快',
  '工作人員偷偷保留了這個位置',
  '系統判定：這張票不屬於你',
]

export function validateAreas(areas) {
  if (!Array.isArray(areas) || !areas.length || areas.length > 20) throw new Error('請設定 1～20 個票區')
  const ids = new Set()
  for (const a of areas) {
    if (!a.id || ids.has(a.id)) throw new Error('票區代碼重複或空白')
    ids.add(a.id)
    if (![a.realSeats,a.fakeSeats,a.price].every(Number.isInteger) || a.realSeats < 0 || a.fakeSeats < 0 || a.realSeats > 999 || a.fakeSeats > 999 || a.realSeats + a.fakeSeats < 1 || a.price < 0 || a.price > 999999) throw new Error('票價或座位數格式錯誤')
  }
}

export function configureAreas(room, configs) {
  validateAreas(configs)
  const seats = room.seats || []
  const ids = new Set(configs.map(a => a.id))
  if (seats.some(s => s.sold && !ids.has(s.areaId))) throw new Error('已售出票區不可移除，可修改名稱與票價')
  for (const a of configs) {
    const sold = seats.filter(s => s.areaId === a.id && s.sold)
    if (sold.length > a.realSeats) throw new Error(`真座位數不得少於已售張數（已售 ${sold.length}）`)
  }
  const nextSeats = []
  const areas = configs.map(a => {
    const old = room.areas.find(old => old.id === a.id)
    const existing = seats.filter(s => s.areaId === a.id)
    if (old?.realSeats === a.realSeats && old?.fakeSeats === a.fakeSeats && existing.length) nextSeats.push(...existing)
    else {
      const sold = existing.filter(s => s.sold)
      nextSeats.push(...sold)
      const start = Math.max(0,...sold.map(s => s.position))
      const truth = [...Array(a.realSeats-sold.length).fill(true),...Array(a.fakeSeats).fill(false)]
      for (let i=truth.length-1;i>0;i--) {const j=randomInt(i+1);[truth[i],truth[j]]=[truth[j],truth[i]]}
      nextSeats.push(...truth.map((isReal,i) => ({id:randomUUID(),areaId:a.id,position:start+i+1,label:`第${Math.floor((start+i)/8)+1}排${(start+i)%8+1}號`,isReal,sold:false})))
    }
    return {...a,total:a.realSeats,remaining:a.realSeats-existing.filter(s => s.sold).length}
  })
  room.areas=areas
  room.seats=nextSeats
}

export function selectForPurchase(room, areaId, seatIds, qty) {
  if (!Array.isArray(seatIds) || !seatIds.length || seatIds.length !== qty || seatIds.length > room.maxPerOrder || new Set(seatIds).size !== seatIds.length) throw new Error('請重新選擇座位')
  const selected = seatIds.map(id => room.seats.find(s => s.id === id && s.areaId === areaId))
  if (selected.some(s => !s)) throw new Error('座位資料失效，請重新選位')
  if (selected.some(s => s.sold)) throw Object.assign(new Error('座位已被購買，請重新選位'),{code:'SEAT_TAKEN'})
  if (selected.some(s => !s.isReal)) throw Object.assign(new Error(FAKE_SEAT_WARNINGS[randomInt(FAKE_SEAT_WARNINGS.length)]),{code:'FAKE_SEAT'})
  return selected
}
