import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoom, listEvents, openSale, type LiveEvent } from '../api'
import { Shell } from '../components/Layout'
import { saveSession } from '../hooks/useRoom'

const ADMIN_KEY = 'pbon-admin'
const DEFAULT_PASS = 'party2026'

function expectedPassword() {
  return (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || DEFAULT_PASS
}

export function isAdminLoggedIn() {
  try {
    return localStorage.getItem(ADMIN_KEY) === '1'
  } catch {
    return false
  }
}

function setAdminLoggedIn(on: boolean) {
  if (on) localStorage.setItem(ADMIN_KEY, '1')
  else localStorage.removeItem(ADMIN_KEY)
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminPage() {
  const [authed, setAuthed] = useState(isAdminLoggedIn)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const [title, setTitle] = useState('PARTY HOUSE 2026 小派對 WORLD TOUR')
  const [subtitle, setSubtitle] = useState('＜FUN ONLY＞ in LIVING ROOM')
  const [venue, setVenue] = useState('你家客廳・派對主舞台')
  const [dateText, setDateText] = useState('今晚開演')
  const [saleAt, setSaleAt] = useState(() => toLocalInputValue(new Date(Date.now() + 10 * 60 * 1000)))
  const [maxPerOrder, setMaxPerOrder] = useState(2)
  const [failChance, setFailChance] = useState(15)
  const [featured, setFeatured] = useState(true)

  const refresh = async () => {
    try {
      const { events: list } = await listEvents()
      setEvents(list)
    } catch {
      setEvents([])
    }
  }

  useEffect(() => {
    if (authed) void refresh()
  }, [authed])

  const onLogin = (e: FormEvent) => {
    e.preventDefault()
    if (password === expectedPassword()) {
      setAdminLoggedIn(true)
      setAuthed(true)
      setLoginError(null)
    } else {
      setLoginError('密碼錯誤')
    }
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const saleDate = new Date(saleAt)
      if (Number.isNaN(saleDate.getTime())) throw new Error('開賣時間格式不正確')
      const { hostId, room } = await createRoom({
        hostName: '主辦',
        title,
        subtitle,
        venue,
        dateText,
        saleAt: saleDate.toISOString(),
        maxPerOrder,
        failChance: failChance / 100,
        queueDelayMs: 2200,
        featured,
      })
      saveSession({
        code: room.code,
        playerId: hostId,
        nickname: '主辦',
        isHost: true,
        hostId,
      })
      setMsg(`已建立活動 ${room.code}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  if (!authed) {
    return (
      <Shell>
        <form className="page-card host-panel flash" onSubmit={onLogin}>
          <h2 style={{ marginTop: 0 }}>後台登入</h2>
          <p className="muted">建立活動、設定開賣時間。一般訪客看不到這頁入口說明。</p>
          <div className="field">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {loginError && <div className="error-box">{loginError}</div>}
          <button className="btn btn-green btn-block">登入</button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="admin-grid flash">
        <form className="page-card host-panel" onSubmit={onCreate}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>建立活動</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAdminLoggedIn(false)
                setAuthed(false)
              }}
            >
              登出
            </button>
          </div>
          <p className="muted">這裡建立的活動會出現在首頁，訪客可進去搶票。</p>

          <div className="field">
            <label>活動名稱</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>副標</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="field">
            <label>地點</label>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="field">
            <label>日期文案（顯示用）</label>
            <input value={dateText} onChange={(e) => setDateText(e.target.value)} />
          </div>
          <div className="field">
            <label>開賣時間</label>
            <input
              type="datetime-local"
              value={saleAt}
              onChange={(e) => setSaleAt(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>每筆限購</label>
            <input
              type="number"
              min={1}
              max={4}
              value={maxPerOrder}
              onChange={(e) => setMaxPerOrder(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>假忙線機率（%）</label>
            <input
              type="number"
              min={0}
              max={60}
              value={failChance}
              onChange={(e) => setFailChance(Number(e.target.value))}
            />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: 14 }}>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            設為首頁主打
          </label>

          {error && <div className="error-box">{error}</div>}
          {msg && <div className="status-pill" style={{ marginBottom: 12 }}>{msg}</div>}
          <button className="btn btn-orange btn-block" disabled={busy}>
            {busy ? '建立中…' : '建立並上架'}
          </button>
        </form>

        <section className="page-card notice-box">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>已上架活動</h2>
          {events.length === 0 ? (
            <p className="muted">尚無活動。建立一筆後首頁就會顯示。</p>
          ) : (
            <div className="admin-event-list">
              {events.map((ev) => (
                <AdminEventRow
                  key={ev.code}
                  ev={ev}
                  onOpen={async () => {
                    const sessionRaw = localStorage.getItem('pbon-session')
                    let hostId = ''
                    try {
                      const s = sessionRaw ? JSON.parse(sessionRaw) : null
                      if (s?.code === ev.code && s.hostId) hostId = s.hostId
                    } catch {
                      /* ignore */
                    }
                    if (!hostId) {
                      setError('請用建立該場的瀏覽器開賣，或重新建立一場')
                      return
                    }
                    await openSale(ev.code, hostId)
                    await refresh()
                  }}
                  onEnter={() => nav(`/r/${ev.code}`)}
                />
              ))}
            </div>
          )}
          <p style={{ marginTop: 16 }}>
            <Link to="/">回售票首頁預覽</Link>
          </p>
        </section>
      </div>
    </Shell>
  )
}

function AdminEventRow({
  ev,
  onOpen,
  onEnter,
}: {
  ev: LiveEvent
  onOpen: () => void
  onEnter: () => void
}) {
  const when = useMemo(() => new Date(ev.saleAt).toLocaleString('zh-TW'), [ev.saleAt])
  const open = ev.saleOpen || Date.now() >= ev.saleAt
  return (
    <div className="admin-event-row">
      <div>
        <strong>
          {ev.title} {ev.featured ? '★' : ''}
        </strong>
        <div className="muted" style={{ fontSize: 12 }}>
          {ev.code} · 開賣 {when} · {open ? '熱賣中' : '尚未開賣'}
        </div>
      </div>
      <div className="share-actions">
        {!open && (
          <button type="button" className="btn btn-green" onClick={onOpen}>
            立刻開賣
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onEnter}>
          進入場次
        </button>
      </div>
    </div>
  )
}
