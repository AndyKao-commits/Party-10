import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shell, StepBar } from '../components/Layout'
import { useRoom } from '../hooks/useRoom'

export function QueuePage() {
  const { code = '' } = useParams()
  const { room } = useRoom(code)
  const nav = useNavigate()
  const [msg, setMsg] = useState('流量控管中，請稍候…')
  const [progress, setProgress] = useState(0)

  const saleOpen = room?.saleOpen
  const queueDelayMs = room?.queueDelayMs
  useEffect(() => {
    if (saleOpen === undefined) return
    if (!saleOpen) {
      nav(`/r/${code}`, { replace: true })
      return
    }

    let cancelled = false
    const delay = queueDelayMs || 2200
    const started = Date.now()
    const messages = [
      '正在驗證您是否是人類…',
      '購票人數過多，系統排隊中…',
      '佛祖保佑大家都能順利搶到票…',
      '即將進入選位頁面…',
    ]
    let i = 0
    const tick = window.setInterval(() => {
      if (cancelled) return
      const p = Math.min(100, ((Date.now() - started) / delay) * 100)
      setProgress(p)
      if (i < messages.length) {
        setMsg(messages[i])
        i += 1
      }
    }, Math.max(400, delay / 4))

    const done = window.setTimeout(() => {
      if (cancelled) return
      if (Math.random() < 0.12) {
        setMsg('目前連線人數過多，請重新再試')
        window.setTimeout(() => {
          if (!cancelled) nav(`/r/${code}`)
        }, 1200)
        return
      }
      nav(`/r/${code}/area`, { replace: true })
    }, delay)

    return () => {
      cancelled = true
      clearInterval(tick)
      clearTimeout(done)
    }
  }, [saleOpen, queueDelayMs, code, nav])

  return (
    <Shell>
      <div className="page-card">
        <StepBar current={0} />
        <div className="queue-screen">
          <div className="spinner" />
          <h2 style={{ margin: '0 0 8px' }}>流量控管中</h2>
          <p className="pulse muted">{msg}</p>
          <div
            style={{
              margin: '18px auto 0',
              width: 'min(320px, 90%)',
              height: 8,
              background: '#e4ebe6',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--pbon-green)',
                transition: 'width 0.2s linear',
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
            房間 {code} · 請勿關閉或重新整理
          </p>
        </div>
      </div>
    </Shell>
  )
}

export function AreaPage() {
  const { code = '' } = useParams()
  const { room } = useRoom(code)
  const nav = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  if (!room) {
    return (
      <Shell>
        <div className="queue-screen page-card">
          <div className="spinner" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="page-card flash">
        <StepBar current={1} />
        <div style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{room.title}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {room.dateText} · {room.venue}
          </p>

          <p className="muted">請選擇票區，再點選座位。</p>
          <div className="ticket-area-head"><span>顏色 / 票區</span><span>票價 NT$</span><span>空位</span></div>
          <div className="ticket-area-list">
            {room.areas.map((a) => {
              const available = room.seats.filter(s => s.areaId === a.id && !s.sold).length
              return (
              <button
                key={a.id}
                type="button"
                className={`ticket-area-row ${selected === a.id ? 'selected' : ''}`}
                disabled={available <= 0}
                onClick={() => setSelected(a.id)}
              >
                <span style={{ width: 8, alignSelf: 'stretch', background: a.color }} />
                <span>
                  <strong>{a.name}</strong>

                </span>
                <span>{a.price.toLocaleString()}</span>
                <span style={{ fontWeight: 800, color: available ? 'var(--pbon-green-deep)' : 'var(--pbon-warn)' }}>
                  {available <= 0 ? '已售完' : `剩 ${available}`}
                </span>
              </button>
            )})}
          </div>

          <button
            className="btn btn-orange btn-block"
            disabled={!selected}
            onClick={() => selected && nav(`/r/${code}/qty?area=${selected}`)}
          >
            下一步
          </button>
        </div>
      </div>
    </Shell>
  )
}

export function QtyPage() {
  const { code = '' } = useParams()
  const { room, error } = useRoom(code)
  const nav = useNavigate()
  const areaId = new URLSearchParams(location.search).get('area') || ''
  const area = room?.areas.find(a => a.id === areaId)
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  if (!room || !area) return <Shell><div className="page-card notice-box">{error || '載入座位中…'}<button className="btn btn-ghost" onClick={() => nav(`/r/${code}/area`)}>返回票區</button></div></Shell>
  const seats = room.seats.filter(s => s.areaId === areaId)
  const valid = selected.filter(id => seats.some(s => s.id === id && !s.sold))
  const toggle = (id: string) => {
    setNotice('')
    if (valid.includes(id)) setSelected(valid.filter(s => s !== id))
    else if (valid.length < room.maxPerOrder) setSelected([...valid,id])
    else setNotice(`每筆最多 ${room.maxPerOrder} 張`)
  }
  return <Shell><div className="page-card flash"><StepBar current={2}/><div style={{padding:16}}>
    <h2>自行選位</h2><p>{area.name} · NT$ {area.price.toLocaleString()} / 張</p>
    <div className="seat-stage">舞台 / 活動主場</div>
    <div className="seat-legend"><span>□ 可選</span><span>■ 已選</span><span>▧ 已售</span></div>
    <div className="seat-map" aria-label="座位圖">{seats.map(seat => <button type="button" key={seat.id} disabled={seat.sold} aria-pressed={valid.includes(seat.id)} aria-label={`${seat.label}${seat.sold ? ' 已售' : ''}`} className={`seat ${seat.sold ? 'sold' : ''} ${valid.includes(seat.id) ? 'chosen' : ''}`} onClick={() => toggle(seat.id)}>{seat.label}</button>)}</div>
    {seats.length === 0 && <div className="error-box">沒有可選座位，請聯絡主辦更新座位資料。</div>}
    <p className="muted">點選座位不會保留，送出購票成功後才成立。每筆最多 {room.maxPerOrder} 張。</p>
    {notice && <div role="status" className="error-box">{notice}</div>}
    {valid.length !== selected.length && <p role="status">部分座位已售出，請重新選擇。</p>}
    <div className="seat-summary"><strong>已選 {valid.length} 張</strong><span>{seats.filter(s => valid.includes(s.id)).map(s => s.label).join('、') || '尚未選擇'}</span><strong>NT$ {(area.price*valid.length).toLocaleString()}</strong></div>
    <div style={{display:'flex',gap:8}}><button className="btn btn-ghost" onClick={() => nav(`/r/${code}/area`)}>上一步</button><button className="btn btn-orange" style={{flex:1}} disabled={!valid.length} onClick={() => {sessionStorage.removeItem(`pbon-order-${code}`);nav(`/r/${code}/checkout?${new URLSearchParams({area:areaId,qty:String(valid.length),seats:valid.join(',')})}`)}}>下一步</button></div>
  </div></div></Shell>
}
