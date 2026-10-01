import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { purchase, validateCard } from '../api'
import { Shell, StepBar } from '../components/Layout'
import { loadSession, useRoom } from '../hooks/useRoom'
import type { Order } from '../types'

export function CheckoutPage() {
  const { code = '' } = useParams()
  const { room } = useRoom(code)
  const nav = useNavigate()
  const session = loadSession()
  const params = new URLSearchParams(location.search)
  const areaId = params.get('area') || ''
  const seatIds = (params.get('seats') || '').split(',').filter(Boolean)
  const qty = seatIds.length
  const area = room?.areas.find((a) => a.id === areaId)
  const [retry, setRetry] = useState(false)
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [expYear, setExpYear] = useState('')
  const [cvv, setCvv] = useState('')

  const total = useMemo(() => (area ? area.price * qty : 0), [area, qty])

  if (!room || !area || qty < 1 || qty > room.maxPerOrder) {
    return (
      <Shell>
        <div className="page-card notice-box">
          <div className="error-box">訂單資料失效，請重來</div>
          <Link to={`/r/${code}`}>回活動頁</Link>
        </div>
      </Shell>
    )
  }

  const onPay = async () => {
    if (!agree) {
      setError('請勾選同意購票與退票規則（假的）')
      return
    }
    if (!cardNumber.trim() || !expMonth || !expYear || !cvv) {
      setError('請輸入派對假信用卡資料')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const check = await validateCard({
        cardNumber,
        expMonth: expMonth.padStart(2, '0'),
        expYear: expYear.padStart(2, '0'),
        cvv,
      })
      if (!check.ok) {
        throw new Error('信用卡驗證失敗：請使用主辦發給你的假卡資料')
      }
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 800))
      const res = await purchase(code, {
        playerId: session?.code === code ? session.playerId : '',
        areaId,
        seatIds,
        qty,
        nickname: session?.nickname || '訪客',
      })
      sessionStorage.setItem(`pbon-order-${code}`, JSON.stringify(res.order))
      nav(`/r/${code}/success`, { replace: true })
    } catch (err) {
      const e = err as Error & { code?: string }
      setError(e.message)
      if (e.code === 'FAKE_SEAT' || e.code === 'SEAT_TAKEN') { sessionStorage.removeItem(`pbon-order-${code}`); setRetry(true) }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      {retry && <div className="seat-dialog-backdrop"><div className="seat-dialog" role="alertdialog" aria-modal="true" aria-labelledby="seat-retry-title"><h2 id="seat-retry-title">{error}</h2><button autoFocus className="btn btn-orange btn-block" onClick={() => nav(`/r/${code}/qty?area=${encodeURIComponent(areaId)}`, {replace:true})}>重新購票</button></div></div>}
      <div className="page-card flash">
        <StepBar current={3} />
        <div style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>填寫購票資訊</h2>
          <div className="page-card" style={{ padding: 12, marginBottom: 14, background: '#f7faf8' }}>
            <div>
              <strong>{area.name}</strong> × {qty}
            </div>
            <div>座位：{room.seats.filter(s => seatIds.includes(s.id)).map(s => s.label).join('、')}</div>
            <div>小計 NT$ {total.toLocaleString()}</div>
          </div>

          <div className="field">
            <label>手機號碼</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="0912345678"
            />
          </div>

          <h3 style={{ fontSize: 15, margin: '8px 0' }}>信用卡付款（假卡）</h3>
          <div className="field">
            <label>卡號</label>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="主辦發給你的卡號"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>月</label>
              <input
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="MM"
              />
            </div>
            <div className="field">
              <label>年</label>
              <input
                value={expYear}
                onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="YY"
              />
            </div>
            <div className="field">
              <label>安全碼</label>
              <input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="4 碼"
              />
            </div>
          </div>

          <div className="field">
            <label>取票方式</label>
            <select defaultValue="eticket">
              <option value="eticket">電子票（截圖）</option>
              <option value="ibon">pbon 機台取票</option>
            </select>
          </div>

          <label className="check-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>我已閱讀並同意購票規則（全部都是假的）。</span>
          </label>

          {error && (
            <div className="error-box shake" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => nav(-1)} disabled={busy}>
              上一步
            </button>
            <button className="btn btn-orange" style={{ flex: 1 }} onClick={onPay} disabled={busy}>
              {busy ? '交易處理中…' : '確認刷卡購票'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function SuccessPage() {
  const { code = '' } = useParams()
  const order = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`pbon-order-${code}`) || 'null') as Order | null
    } catch {
      return null
    }
  }, [code])

  if (!order) {
    return (
      <Shell>
        <div className="page-card notice-box">
          <div className="error-box">找不到訂單，可能還沒搶到</div>
          <Link to={`/r/${code}`}>回活動頁再試一次</Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="page-card flash">
        <StepBar current={5} />
        <div className="ticket-success">
          <div className="status-pill">訂票完成</div>
          <h2 style={{ marginBottom: 4 }}>購票成功！</h2>
          <p className="muted">請截圖保存，這是你今晚的戰利品。</p>
          <div className="ticket-stub">
            <div className="muted" style={{ fontSize: 12 }}>pbon 派對售票系統</div>
            <div style={{ fontWeight: 800, fontSize: 18, margin: '8px 0' }}>{order.areaName}</div>
            <div>購票人：{order.nickname}</div>
            <div>座位：{order.seats.join('、')}</div>
            <div>張數：{order.qty}</div>
            {order.unitPrice != null && <div>成交金額：NT$ {(order.unitPrice * order.qty).toLocaleString()}</div>}
            <div style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.08em' }}>
              {order.code}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>取票序號（假的）</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-green" to={`/r/${code}`}>
              回活動頁看戰況
            </Link>
            <Link className="btn btn-ghost" to={`/r/${code}/queue`}>
              再搶一張碰碰運氣
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  )
}
