import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { purchase } from '../api'
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
  const qty = Number(params.get('qty') || 1)
  const area = room?.areas.find((a) => a.id === areaId)
  const [phone, setPhone] = useState('0912345678')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => (area ? area.price * qty : 0), [area, qty])

  if (!room || !area) {
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
    setBusy(true)
    setError(null)
    try {
      // Fake thinking / 3D auth delay
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 800))
      const res = await purchase(code, {
        playerId: session?.playerId || '',
        areaId,
        qty,
        nickname: session?.nickname || '訪客',
      })
      sessionStorage.setItem(`pbon-order-${code}`, JSON.stringify(res.order))
      nav(`/r/${code}/success`, { replace: true })
    } catch (err) {
      const e = err as Error & { code?: string }
      setError(e.message)
      if (e.code === 'SOLD_OUT' || e.code === 'BUSY') {
        // stay and let them retry or go back
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="page-card flash">
        <StepBar current={3} />
        <div style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>填寫購票資訊</h2>
          <div className="page-card" style={{ padding: 12, marginBottom: 14, background: '#f7faf8' }}>
            <div>
              <strong>{area.name}</strong> × {qty}
            </div>
            <div>小計 NT$ {total.toLocaleString()}</div>
            <div className="muted" style={{ fontSize: 12 }}>購物車保留時間（假的）09:59</div>
          </div>

          <div className="field">
            <label>手機號碼</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>付款方式</label>
            <select defaultValue="card">
              <option value="card">信用卡（假的，不會扣款）</option>
              <option value="atm">ATM 虛擬帳號（假的）</option>
              <option value="party">用真心付款</option>
            </select>
          </div>
          <div className="field">
            <label>取票方式</label>
            <select defaultValue="ibon">
              <option value="ibon">pbon 機台取票（走到客廳角落即可）</option>
              <option value="eticket">電子票（截圖）</option>
            </select>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 14 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>我已閱讀並同意網路服務契約、購票與退票規則（全部都是假的）。</span>
          </label>

          {error && <div className="error-box shake" style={{ marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => nav(-1)} disabled={busy}>
              上一步
            </button>
            <button className="btn btn-orange" style={{ flex: 1 }} onClick={onPay} disabled={busy}>
              {busy ? '交易處理中…' : '確認購票'}
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
          <h2 style={{ marginBottom: 4 }}>恭喜搶到假票！</h2>
          <p className="muted">請截圖保存，這是你今晚的戰利品。</p>

          <div className="ticket-stub">
            <div className="muted" style={{ fontSize: 12 }}>pbon 派對售票系統</div>
            <div style={{ fontWeight: 800, fontSize: 18, margin: '8px 0' }}>{order.areaName}</div>
            <div>購票人：{order.nickname}</div>
            <div>座位：{order.seats.join('、')}</div>
            <div>張數：{order.qty}</div>
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
