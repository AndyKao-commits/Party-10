import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shell, StepBar } from '../components/Layout'
import { loadSession, useRoom } from '../hooks/useRoom'

export function QueuePage() {
  const { code = '' } = useParams()
  const { room } = useRoom(code)
  const nav = useNavigate()
  const [msg, setMsg] = useState('流量控管中，請稍候…')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!room) return
    if (!room.saleOpen) {
      nav(`/r/${code}`, { replace: true })
      return
    }

    let cancelled = false
    const delay = room.queueDelayMs || 2200
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
  }, [room, code, nav])

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
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
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

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className={`btn ${mode === 'auto' ? 'btn-green' : 'btn-ghost'}`}
              onClick={() => setMode('auto')}
            >
              電腦配位（系統預設）
            </button>
            <button
              className={`btn ${mode === 'manual' ? 'btn-green' : 'btn-ghost'}`}
              onClick={() => setMode('manual')}
            >
              自行選位
            </button>
          </div>

          <p className="muted" style={{ fontSize: 13 }}>
            {mode === 'auto'
              ? '系統會由該區域最靠近舞台中央之連位，依購票順序分配。'
              : '派對版自行選位：先選票區，座位仍由系統亂數產生（比較好笑）。'}
          </p>

          <div className="area-grid">
            {room.areas.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`area-card ${selected === a.id ? 'selected' : ''}`}
                disabled={a.remaining <= 0}
                onClick={() => setSelected(a.id)}
              >
                <span style={{ width: 10, alignSelf: 'stretch', background: a.color }} />
                <span>
                  <strong>{a.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    NT$ {a.price.toLocaleString()} · 剩 {a.remaining}
                  </div>
                </span>
                <span style={{ fontWeight: 800, color: a.remaining ? 'var(--pbon-green-deep)' : 'var(--pbon-warn)' }}>
                  {a.remaining <= 0 ? '售完' : '熱賣中'}
                </span>
              </button>
            ))}
          </div>

          <button
            className="btn btn-orange btn-block"
            disabled={!selected}
            onClick={() => selected && nav(`/r/${code}/qty?area=${selected}&mode=${mode}`)}
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
  const { room } = useRoom(code)
  const nav = useNavigate()
  const params = new URLSearchParams(location.search)
  const areaId = params.get('area') || ''
  const mode = params.get('mode') || 'auto'
  const area = room?.areas.find((a) => a.id === areaId)
  const session = loadSession()
  const [qty, setQty] = useState(1)
  const max = Math.min(room?.maxPerOrder || 2, area?.remaining || 1)

  if (!room || !area) {
    return (
      <Shell>
        <div className="page-card notice-box">
          <div className="error-box">請重新選擇票區</div>
          <button className="btn btn-ghost" onClick={() => nav(`/r/${code}/area`)}>
            返回
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="page-card flash">
        <StepBar current={2} />
        <div style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>選擇張數</h2>
          <p>
            {area.name} · NT$ {area.price.toLocaleString()} · {mode === 'auto' ? '電腦配位' : '自行選位'}
          </p>
          <div className="qty-row" style={{ margin: '18px 0' }}>
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              −
            </button>
            <strong style={{ fontSize: 22, minWidth: 40, textAlign: 'center' }}>{qty}</strong>
            <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max}>
              ＋
            </button>
            <span className="muted">最多 {max} 張</span>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, fontSize: 13 }}>
            <input type="checkbox" defaultChecked /> 我接受不連位（派對版永遠勾著也沒用）
          </label>
          <p className="muted" style={{ fontSize: 13 }}>
            購票人：{session?.nickname || '訪客'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => nav(`/r/${code}/area`)}>
              上一步
            </button>
            <button
              className="btn btn-orange"
              style={{ flex: 1 }}
              onClick={() => nav(`/r/${code}/checkout?area=${areaId}&qty=${qty}`)}
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
