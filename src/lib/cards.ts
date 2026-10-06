export type FakeCard = {
  id: string
  label: string
  holder: string
  cardNumber: string
  expMonth: string
  expYear: string
  cvv: string
  createdAt: number
}

function randDigits(n: number) {
  let s = ''
  const values = new Uint8Array(n)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else for (let i = 0; i < n; i++) values[i] = Math.floor(Math.random() * 256)
  for (let i = 0; i < n; i++) s += values[i] % 10
  return s
}

function luhnValid(value: string) {
  let sum = 0
  let double = false
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = Number(value[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** Generate realistic-looking display data that is deliberately not a valid payment card. */
export function generateFakeCard(label = ''): Omit<FakeCard, 'id' | 'createdAt'> {
  const prefix = Math.random() < 0.5 ? '4' : '5'
  let raw = `${prefix}${randDigits(15)}`
  if (luhnValid(raw)) raw = `${raw.slice(0, -1)}${(Number(raw.at(-1)) + 1) % 10}`
  const cardNumber = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  const now = new Date()
  const expYear = String((now.getFullYear() + 2 + Math.floor(Math.random() * 3)) % 100).padStart(2, '0')
  const expMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const cvv = randDigits(3)
  return {
    label,
    holder: label ? label.toUpperCase() : 'PARTY GUEST',
    cardNumber,
    expMonth,
    expYear,
    cvv,
  }
}

export function formatCardForShare(c: FakeCard) {
  return [
    c.label ? `給：${c.label}` : '派對假卡',
    `卡號 ${c.cardNumber}`,
    `有效 ${c.expMonth}/${c.expYear}`,
    `安全碼 ${c.cvv}`,
  ].join('\n')
}
