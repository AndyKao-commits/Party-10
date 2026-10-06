import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getRoom, listDecoys, listEvents, type LiveEvent } from '../api'
import { startPrankAudio } from '../lib/prankAudio'
import { EventOverview } from '../components/EventOverview'
import { Shell } from '../components/Layout'
import { useCountdown } from '../hooks/useCountdown'
import {
  CATEGORIES,
  FAKE_EVENTS,
  FAKE_NEWS,
  getEventBySlug,
  type FakeEvent,
} from '../data/catalog'
import type { Room } from '../types'
import { useAccess } from '../lib/access'

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

type CatalogItem = {
  id: string
  title: string
  subtitle: string
  dateText: string
  venue: string
  imageUrl?: string
  status: string
  category: string
  href: string
}

function EventCard({ event }: { event: CatalogItem }) {
  return (
    <Link to={event.href} className="event-card">
      <div className="event-card__art">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="poster-fallback">{event.title}</span>
        )}
      </div>
      <div className="event-card__body">
        <div className="card-meta">
          <span
            className={`ticket-status ${event.status === '即將開賣' ? 'coming' : event.status === '已結束' ? 'ended' : ''}`}
          >
            {event.status}
          </span>
          <span>{CATEGORIES.find((c) => c.id === event.category)?.label}</span>
        </div>
        <h3>{event.title}</h3>
        <p className="event-date">{event.dateText}</p>
        <p className="muted">{event.venue}</p>
      </div>
    </Link>
  )
}

function Spotlight({ events }: { events: CatalogItem[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const touchStart = useRef<number | null>(null)
  const swiped = useRef(false)
  useEffect(() => {
    if (
      paused ||
      hovered ||
      events.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % events.length),
      6500,
    )
    return () => window.clearInterval(timer)
  }, [events.length, paused, hovered])
  const event = events[index % events.length]
  if (!event) return null
  return (
    <section
      className="spotlight"
      aria-label="精選節目"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      onTouchStart={(e) => {
        swiped.current = false
        touchStart.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current
        touchStart.current = null
        const end = e.changedTouches[0]?.clientX
        if (start == null || end == null || Math.abs(end - start) < 45) return
        swiped.current = true
        setIndex(
          (i) => (i + (end < start ? 1 : -1) + events.length) % events.length,
        )
      }}
    >
      <Link
        to={event.href}
        className="spotlight__link"
        onClick={(e) => {
          if (swiped.current) {
            e.preventDefault()
            swiped.current = false
          }
        }}
      >
        <div className="spotlight__art">
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.title}
              fetchPriority="high"
              decoding="async"
            />
          )}
        </div>
        <div className="spotlight__caption">
          <h1>{event.title}</h1>
          <p>
            {event.dateText} · {event.venue}
          </p>
        </div>
      </Link>
      <div className="spotlight__controls">
        <button
          type="button"
          aria-label="上一個節目"
          onClick={() =>
            setIndex((i) => (i - 1 + events.length) % events.length)
          }
        >
          ‹
        </button>
        {events.map((e, i) =>
          Math.floor(i / 5) === Math.floor((index % events.length) / 5) ? (
            <button
              key={e.id}
              type="button"
              aria-label={`顯示 ${e.title}`}
              aria-pressed={i === index % events.length}
              className={`spotlight__dot ${i === index % events.length ? 'active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ) : null,
        )}
        <span className="spotlight__counter">
          {(index % events.length) + 1} / {events.length}
        </span>
        <button
          type="button"
          aria-label="下一個節目"
          onClick={() => setIndex((i) => (i + 1) % events.length)}
        >
          ›
        </button>
        <button
          type="button"
          className="spotlight__pause"
          aria-label={paused ? '播放輪播' : '暫停輪播'}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '播放' : '暫停'}
        </button>
      </div>
    </section>
  )
}

export function CatalogHome() {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [live, setLive] = useState<LiveEvent[]>([])
  const [decoys, setDecoys] = useState<FakeEvent[]>(FAKE_EVENTS)
  const [loadError, setLoadError] = useState(false)
  const nav = useNavigate()
  useEffect(() => {
    let cancelled = false
    listEvents()
      .then((r) => {
        if (!cancelled) setLive(r.events)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    listDecoys()
      .then((r) => {
        if (!cancelled && r.events.length) setDecoys(r.events)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const events = useMemo(() => {
    const items: CatalogItem[] = decoys.map((e) => ({
      ...e,
      status: statusLabel(e),
      href: `/ActivityInfo/Details/${e.slug}`,
    }))
    const liveItems: CatalogItem[] = live.map((e) => ({
      ...e,
      id: e.code,
      category: 'concert',
      status: liveStatus(e),
      href: `/ActivityInfo/Details/${e.code}`,
    }))
    items.splice(Math.min(2, items.length), 0, ...liveItems)
    return items
  }, [live, decoys])
  const filtered = events.filter(
    (e) =>
      (cat === 'all' || e.category === cat) &&
      `${e.title} ${e.subtitle} ${e.venue}`
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  )
  const spotlights = events.filter((e) => Boolean(e.imageUrl))
  return (
    <Shell>
      <div className="catalog">
        <Spotlight events={spotlights} />
        <div className="announcement-strip">
          <strong>最新公告</strong>
          <Link to="/news">開賣前請確認購票資訊，並保持頁面連線</Link>
          <Link to="/news" className="announcement-more">
            更多 →
          </Link>
        </div>
        <section className="catalog-list" aria-labelledby="catalog-title">
          <div className="catalog-toolbar">
            <div>
              <span className="section-kicker">PROGRAMS</span>
              <h2 id="catalog-title">熱門節目</h2>
            </div>
            <form
              className="catalog-search"
              onSubmit={(e) => {
                e.preventDefault()
                nav(`/search?q=${encodeURIComponent(q.trim())}`)
              }}
            >
              <input
                aria-label="搜尋節目、藝人或場地"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋節目、藝人或場地"
                enterKeyHint="search"
              />
              <button type="submit" aria-label="搜尋">
                搜尋
              </button>
            </form>
          </div>
          <div className="catalog-categories" aria-label="節目分類">
            {CATEGORIES.filter((c) => c.id !== 'party').map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cat === c.id}
                className={cat === c.id ? 'active' : ''}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
            <span className="catalog-count">共 {filtered.length} 個節目</span>
          </div>
          {loadError && (
            <p className="catalog-message" role="status">
              部分活動暫時無法載入，請重新整理再試。
            </p>
          )}
          <div className="event-grid">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-results">
              沒有符合條件的節目。
              <button
                type="button"
                onClick={() => {
                  setQ('')
                  setCat('all')
                }}
              >
                查看全部節目
              </button>
            </div>
          )}
        </section>
        <section className="catalog-news">
          <div className="section-head">
            <h2>消息公告</h2>
            <Link to="/news">更多公告 →</Link>
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
  const [event, setEvent] = useState<FakeEvent | undefined>(() =>
    getEventBySlug(slug),
  )
  const nav = useNavigate()
  const {status}=useAccess()
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
    listDecoys()
      .then((r) => {
        if (cancelled) return
        const found = r.events.find(
          (e: FakeEvent) => e.slug === slug || e.id === slug,
        )
        setEvent(found || getEventBySlug(slug))
      })
      .catch(() => {
        if (!cancelled) setEvent(getEventBySlug(slug))
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
        <EventOverview
          title={live.title}
          subtitle={live.subtitle}
          imageUrl={live.imageUrl}
          dateText={live.dateText}
          venue={live.venue}
          priceText={live.areas
            .map((a) => `NT$${a.price.toLocaleString()}`)
            .join(' / ')}
          status={open ? '熱賣中' : '即將開賣'}
          saleText={new Date(live.saleAt).toLocaleString('zh-TW', {
            timeZone: 'Asia/Taipei',
            hour12: false,
          })}
          countdown={open ? undefined : label}
          notices={live.notices}
          disabled={!open}
          onBuy={() => nav(`/r/${live.code}`)}
        />
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
    if(!status?.member){nav(`/account?next=${encodeURIComponent(`/ActivityInfo/Details/${slug}`)}`);return}
    window.alert('你的手機中毒了!')
    void startPrankAudio().catch(() => { /* Playback page provides a tap-to-play fallback. */ })
    nav('/prank')
  }

  return (
    <Shell>
      <EventOverview
        title={event.title}
        subtitle={event.subtitle.includes('假') ? '' : event.subtitle}
        imageUrl={event.imageUrl}
        dateText={event.dateText}
        venue={event.venue}
        priceText={event.priceText}
        status={statusLabel(event)}
        onBuy={onBuy}
      />
    </Shell>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('category') || 'all'
  const [live, setLive] = useState<LiveEvent[]>([])
  const [decoys, setDecoys] = useState<FakeEvent[]>(FAKE_EVENTS)
  useEffect(() => {
    let cancelled = false
    listEvents()
      .then((r) => {
        if (!cancelled) setLive(r.events)
      })
      .catch(() => {})
    listDecoys()
      .then((r) => {
        if (!cancelled && r.events.length) setDecoys(r.events)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const events: CatalogItem[] = [
    ...decoys.map((e) => ({
      ...e,
      status: statusLabel(e),
      href: `/ActivityInfo/Details/${e.slug}`,
    })),
    ...live.map((e) => ({
      ...e,
      id: e.code,
      category: 'concert',
      status: liveStatus(e),
      href: `/ActivityInfo/Details/${e.code}`,
    })),
  ]
  const results = events.filter(
    (e) =>
      (category === 'all' || e.category === category) &&
      `${e.title} ${e.venue} ${e.subtitle}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  )
  return (
    <Shell>
      <div className="detail-breadcrumb">
        <Link to="/">首頁</Link> / 節目搜尋
      </div>
      <section className="catalog-list">
        <div className="section-head">
          <h2>
            {q
              ? `搜尋結果：${q}`
              : CATEGORIES.find((c) => c.id === category)?.label || '全部節目'}
          </h2>
          <span className="muted">共 {results.length} 個節目</span>
        </div>
        <div className="event-grid">
          {results.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
        {!results.length && (
          <p className="empty-results">
            沒有符合條件的節目。<Link to="/">回首頁查看其他節目</Link>
          </p>
        )}
      </section>
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
          setMsg(
            phone.trim()
              ? '查無訂單。若剛完成購票，請保留成功頁截圖。'
              : '請輸入手機號碼',
          )
        }}
      >
        <h2 style={{ marginTop: 0 }}>訂單查詢</h2>
        <div className="field">
          <label>手機號碼</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
        </div>
        {msg && <div className="error-box">{msg}</div>}
        <button className="btn btn-green btn-block">查詢</button>
      </form>
    </Shell>
  )
}
