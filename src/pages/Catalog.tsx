import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getRoom, listEvents, type LiveEvent } from '../api'
import { Shell } from '../components/Layout'
import { useCountdown } from '../hooks/useCountdown'
import {
  BANNERS,
  CATEGORIES,
  FAKE_EVENTS,
  FAKE_NEWS,
  getEventBySlug,
  type FakeEvent,
} from '../data/catalog'
import type { Room } from '../types'

const LIVE_GRADIENTS = [
  'linear-gradient(160deg,#0b3d2c 0%,#145c3f 40%,#1a1a1a 100%)',
  'linear-gradient(160deg,#7c2d12 0%,#ea580c 45%,#1c1917 100%)',
  'linear-gradient(160deg,#1e3a8a 0%,#2563eb 45%,#0f172a 100%)',
]

function statusLabel(e: FakeEvent) {
  if (e.status === 'ended') return '已結束'
  if (e.status === 'coming') return '即將開賣'
  if (e.status === 'hot') return '熱賣中'
  return '販售中'
}

function liveStatus(ev: LiveEvent) {
  if (ev.saleOpen || Date.now() >= ev.saleAt) return '熱賣中'
  return '即將開賣'
}

export function CatalogHome() {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [live, setLive] = useState<LiveEvent[]>([])
  const nav = useNavigate()

  useEffect(() => {
    listEvents()
      .then((r) => setLive(r.events))
      .catch(() => setLive([]))
  }, [])

  const decoys = useMemo(() => {
    return FAKE_EVENTS.filter((e) => {
      if (cat !== 'all' && e.category !== cat) return false
      if (!q.trim()) return true
      const s = q.trim().toLowerCase()
      return (
        e.title.toLowerCase().includes(s) ||
        e.venue.toLowerCase().includes(s) ||
        e.subtitle.toLowerCase().includes(s)
      )
    })
  }, [cat, q])

  const liveFiltered = useMemo(() => {
    if (cat !== 'all' && cat !== 'party' && cat !== 'concert') return []
    if (!q.trim()) return live
    const s = q.trim().toLowerCase()
    return live.filter(
      (e) =>
        e.title.toLowerCase().includes(s) ||
        e.venue.toLowerCase().includes(s) ||
        e.subtitle.toLowerCase().includes(s),
    )
  }, [live, cat, q])

  const featured = live.find((e) => e.featured) || live[0]
  const { label, done } = useCountdown(featured?.saleAt)

  return (
    <Shell>
      <div className="catalog flash">
        <section className="search-bar page-card">
          <form
            className="search-bar__form"
            onSubmit={(e) => {
              e.preventDefault()
              nav(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="詳細搜尋節目、藝人、場地…"
              enterKeyHint="search"
            />
            <button className="btn btn-green" type="submit">
              搜尋
            </button>
          </form>
          <div className="cat-scroll">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat-chip ${cat === c.id ? 'active' : ''}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="banner-row">
          {BANNERS.map((b) => (
            <Link key={b.id} to="/news" className={`promo-banner tone-${b.tone}`}>
              <strong>{b.title}</strong>
              <span>{b.desc}</span>
            </Link>
          ))}
        </section>

        {featured && (
          <section className="page-card featured-party">
            <div className="featured-party__tag">
              {done || featured.saleOpen ? '熱賣中' : '即將開賣'}・精選活動
            </div>
            <div className="featured-party__grid">
              <div className="event-poster" style={{ background: LIVE_GRADIENTS[0] }}>
                <div className="poster__eyebrow">pbon TICKET</div>
                <h2 className="poster__title">{featured.title}</h2>
                <div className="poster__sub">{featured.subtitle}</div>
              </div>
              <div>
                <h1 className="activity-title" style={{ fontSize: 26 }}>
                  {featured.title}
                </h1>
                <ul className="meta-list">
                  <li>
                    <strong>場地</strong>
                    <span>{featured.venue}</span>
                  </li>
                  <li>
                    <strong>時間</strong>
                    <span>{featured.dateText}</span>
                  </li>
                  <li>
                    <strong>開賣</strong>
                    <span>
                      {done || featured.saleOpen ? '已開賣' : `倒數 ${label}`}
                    </span>
                  </li>
                </ul>
                <div className="landing-actions">
                  <Link className="btn btn-orange" to={`/ActivityInfo/Details/${featured.code}`}>
                    查看活動／購票
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {liveFiltered.length > 0 && (
          <section className="page-card">
            <div className="section-head">
              <h2>可購票活動</h2>
              <span className="muted">後台上架</span>
            </div>
            <div className="event-grid">
              {liveFiltered.map((e, i) => (
                <Link
                  key={e.code}
                  to={`/ActivityInfo/Details/${e.code}`}
                  className="event-card buyable"
                >
                  <div
                    className="event-card__art"
                    style={{ background: LIVE_GRADIENTS[i % LIVE_GRADIENTS.length] }}
                  >
                    <span className="event-card__badge">{liveStatus(e)}</span>
                  </div>
                  <div className="event-card__body">
                    <div className="event-card__status">{liveStatus(e)}</div>
                    <h3>{e.title}</h3>
                    <p>{e.dateText}</p>
                    <p className="muted">{e.venue}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="page-card">
          <div className="section-head">
            <h2>熱門活動推薦</h2>
            <span className="muted">更多節目</span>
          </div>
          <div className="event-grid">
            {decoys.map((e) => (
              <Link key={e.id} to={`/ActivityInfo/Details/${e.slug}`} className="event-card">
                <div className="event-card__art" style={{ background: e.gradient }}>
                  {e.badge && <span className="event-card__badge">{e.badge}</span>}
                </div>
                <div className="event-card__body">
                  <div className="event-card__status">{statusLabel(e)}</div>
                  <h3>{e.title}</h3>
                  <p>{e.dateText}</p>
                  <p className="muted">{e.venue}</p>
                  <strong>{e.priceText}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="page-card notice-box">
          <div className="section-head" style={{ marginBottom: 8, padding: 0 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>消息公告</h2>
            <Link to="/news">更多</Link>
          </div>
          <ul className="news-list">
            {FAKE_NEWS.slice(0, 3).map((n) => (
              <li key={n.id}>
                <span>{n.date}</span>
                <Link to="/news">{n.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  )
}

export function FakeActivityPage() {
  const { slug = '' } = useParams()
  const event = getEventBySlug(slug)
  const nav = useNavigate()
  const [msg, setMsg] = useState<string | null>(null)
  const [live, setLive] = useState<Room | null>(null)
  const [loadingLive, setLoadingLive] = useState(true)
  const { label, done } = useCountdown(live?.saleAt)

  useEffect(() => {
    let cancelled = false
    setLoadingLive(true)
    getRoom(slug)
      .then((r) => {
        if (!cancelled) setLive(r.room)
      })
      .catch(() => {
        if (!cancelled) setLive(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingLive(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loadingLive) {
    return (
      <Shell>
        <div className="queue-screen page-card">
          <div className="spinner" />
          <p className="pulse">載入活動資訊…</p>
        </div>
      </Shell>
    )
  }

  if (live) {
    const open = live.saleOpen || done
    return (
      <Shell>
        <div className="page-card flash">
          <div className="hero-grid">
            <div className="event-poster tall" style={{ background: LIVE_GRADIENTS[0] }}>
              <div className="poster__eyebrow">pbon TICKET</div>
              <h2 className="poster__title">{live.title}</h2>
              <div className="poster__sub">{live.subtitle}</div>
            </div>
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className={`status-pill ${open ? 'hot' : ''}`}>
                  {open ? '熱賣中' : '即將開賣'}
                </span>
                <span className="status-pill">線上購票</span>
              </div>
              <h1 className="activity-title">{live.title}</h1>
              <ul className="meta-list">
                <li>
                  <strong>演出時間</strong>
                  <span>{live.dateText}</span>
                </li>
                <li>
                  <strong>演出地點</strong>
                  <span>{live.venue}</span>
                </li>
                <li>
                  <strong>開賣時間</strong>
                  <span>{open ? '已開賣' : label}</span>
                </li>
              </ul>
              <div className="sale-banner">
                <div>
                  <div className="sale-banner__label">
                    {open ? '點選線上購票開始搶票' : '距離開賣還有'}
                  </div>
                  {!open && <div className="countdown">{label}</div>}
                </div>
                <button
                  className="btn btn-orange buy-cta"
                  type="button"
                  disabled={!open}
                  onClick={() => nav(`/r/${live.code}`)}
                >
                  {open ? '線上購票' : '尚未開賣'}
                </button>
              </div>
            </div>
          </div>
          <div className="notice-box">
            <h3>購票須知</h3>
            <ul>
              {live.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </Shell>
    )
  }

  if (!event) {
    return (
      <Shell>
        <div className="page-card notice-box">
          <div className="error-box">找不到此活動</div>
          <Link to="/">回首頁</Link>
        </div>
      </Shell>
    )
  }

  const onBuy = () => {
    if (event.status === 'ended') {
      setMsg('本活動已結束或售完，無法購票。')
      return
    }
    if (event.status === 'coming') {
      setMsg('尚未開賣。請稍後再試，或選購其他熱賣中節目。')
      return
    }
    setMsg('目前購票人數過多，系統流量控管中，請重新再試。')
  }

  return (
    <Shell>
      <div className="page-card flash">
        <div className="hero-grid">
          <div className="event-poster tall" style={{ background: event.gradient }}>
            <div className="poster__eyebrow">ACTIVITY</div>
            <h2 className="poster__title">{event.title}</h2>
            <div className="poster__sub">{event.subtitle}</div>
          </div>
          <div>
            <span className="status-pill">{statusLabel(event)}</span>
            <h1 className="activity-title">{event.title}</h1>
            <p className="muted">{event.blurb}</p>
            <ul className="meta-list">
              <li>
                <strong>演出時間</strong>
                <span>{event.dateText}</span>
              </li>
              <li>
                <strong>演出地點</strong>
                <span>{event.venue}</span>
              </li>
              <li>
                <strong>票價</strong>
                <span>{event.priceText}</span>
              </li>
            </ul>
            <div className="sale-banner">
              <div>
                <div className="sale-banner__label">線上購票</div>
              </div>
              <button className="btn btn-orange buy-cta" type="button" onClick={onBuy}>
                線上購票
              </button>
            </div>
            {msg && (
              <div className="error-box shake" style={{ marginTop: 12 }}>
                {msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [live, setLive] = useState<LiveEvent[]>([])

  useEffect(() => {
    listEvents()
      .then((r) => setLive(r.events))
      .catch(() => setLive([]))
  }, [])

  const results = FAKE_EVENTS.filter((e) => {
    const s = q.toLowerCase()
    return (
      e.title.toLowerCase().includes(s) ||
      e.venue.toLowerCase().includes(s) ||
      e.subtitle.toLowerCase().includes(s)
    )
  })
  const liveResults = live.filter((e) => {
    const s = q.toLowerCase()
    return (
      !s ||
      e.title.toLowerCase().includes(s) ||
      e.venue.toLowerCase().includes(s) ||
      e.subtitle.toLowerCase().includes(s)
    )
  })

  return (
    <Shell>
      <div className="page-card notice-box flash">
        <h2 style={{ marginTop: 0 }}>搜尋結果：{q || '（全部）'}</h2>
        <div className="event-grid">
          {liveResults.map((e, i) => (
            <Link key={e.code} to={`/ActivityInfo/Details/${e.code}`} className="event-card buyable">
              <div
                className="event-card__art"
                style={{ background: LIVE_GRADIENTS[i % LIVE_GRADIENTS.length] }}
              />
              <div className="event-card__body">
                <h3>{e.title}</h3>
                <p className="muted">{e.venue}</p>
              </div>
            </Link>
          ))}
          {results.map((e) => (
            <Link key={e.id} to={`/ActivityInfo/Details/${e.slug}`} className="event-card">
              <div className="event-card__art" style={{ background: e.gradient }} />
              <div className="event-card__body">
                <h3>{e.title}</h3>
                <p className="muted">{e.venue}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  )
}

export function NewsPage() {
  return (
    <Shell>
      <div className="page-card notice-box flash">
        <h2 style={{ marginTop: 0 }}>消息公告</h2>
        <ul className="news-list">
          {FAKE_NEWS.map((n) => (
            <li key={n.id}>
              <span>{n.date}</span>
              <strong>{n.title}</strong>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  )
}

export function OrdersPage() {
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <Shell>
      <form
        className="page-card host-panel flash"
        onSubmit={(e) => {
          e.preventDefault()
          setMsg(phone.trim() ? '查無訂單。若剛完成購票，請保留成功頁截圖。' : '請輸入手機號碼')
        }}
      >
        <h2 style={{ marginTop: 0 }}>訂單查詢</h2>
        <div className="field">
          <label>手機號碼</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        {msg && <div className="error-box">{msg}</div>}
        <button className="btn btn-green btn-block">查詢</button>
      </form>
    </Shell>
  )
}
