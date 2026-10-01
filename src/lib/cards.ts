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
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10)
  return s
}

/** Generate a display card number (groups of 4). */
export function generateFakeCard(label = ''): Omit<FakeCard, 'id' | 'createdAt'> {
  // Start with 4 (Visa-like) for recognizability; not a real issuer BIN.
  const raw = `4${randDigits(15)}`
  const cardNumber = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  const now = new Date()
  const expYear = String((now.getFullYear() + 2 + Math.floor(Math.random() * 3)) % 100).padStart(2, '0')
  const expMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const cvv = randDigits(4) // party rule: 4-digit security code
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
