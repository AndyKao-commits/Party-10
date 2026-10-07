import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getRoom, listDecoys, listEvents, lookupTicketOrders, pickupTicketOrder, type LiveEvent } from '../api'
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
import type { Room, TicketLookupOrder } from '../types'
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
  const [orders, setOrders] = useState<TicketLookupOrder[]>([])
  const [opened, setOpened] = useState<TicketLookupOrder | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const searchOrders = async () => {
    const normalized = phone.replace(/\D/g, '')
    if (!normalized) { setMsg('請輸入手機號碼'); return }
    setBusy(true); setMsg(null); setOpened(null)
    try {
      const result = await lookupTicketOrders(normalized)
      setOrders(result.orders)
      if (!result.orders.length) setMsg('查無訂單，請確認輸入的是註冊時使用的電話號碼。')
    } catch (err) {
      setOrders([])
      setMsg(err instanceof Error ? err.message : '訂單查詢失敗')
    } finally { setBusy(false) }
  }

  const pickup = async (order: TicketLookupOrder) => {
    setBusy(true); setMsg(null)
    try {
      const result = await pickupTicketOrder(phone, order.id)
      const updated = { ...order, pickedUpAt: result.pickedUpAt }
      setOrders(list => list.map(item => item.id === order.id ? updated : item))
      setOpened(updated)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '取票失敗')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      {opened && <div className="ticket-viewer" role="dialog" aria-modal="true" aria-label="電子票券">
        <div className="ticket-viewer__bar"><strong>電子票券</strong><button type="button" onClick={() => setOpened(null)} aria-label="關閉票券">關閉</button></div>
        <div className="digital-ticket-stack">
          {opened.tickets.map(ticket => <article className="digital-ticket" key={ticket.ticketCode}>
            <div className="digital-ticket__art" style={opened.eventImage ? {backgroundImage:`linear-gradient(180deg,#09271933,#092719dd),url(${opened.eventImage})`} : undefined}>
              <span>PBON DIGITAL TICKET</span><h2>{opened.eventTitle}</h2><p>{opened.eventDate}</p>
            </div>
            <div className="digital-ticket__body">
              <div className="ticket-seat"><small>{opened.areaName}</small><strong>{ticket.seat}</strong></div>
              <dl><dt>購票人</dt><dd>{opened.buyerName}</dd><dt>票價</dt><dd>NT$ {(opened.unitPrice || 0).toLocaleString()}</dd><dt>取票序號</dt><dd>{ticket.ticketCode}</dd></dl>
              {opened.ticketContent && <div className="ticket-special"><strong>票券內容</strong><p>{opened.ticketContent}</p></div>}
              <div className="ticket-bars" aria-hidden="true" />
              <small className="ticket-disclaimer">派對娛樂票券・無真實交易效力</small>
            </div>
          </article>)}
        </div>
      </div>}
      <form
        className="page-card host-panel flash"
        onSubmit={(e) => { e.preventDefault(); void searchOrders() }}
      >
        <h2 style={{ marginTop: 0 }}>訂單查詢</h2>
        <p className="muted">輸入註冊時使用的電話號碼，即可查詢並領取電子票券。</p>
        <div className="field">
          <label>手機號碼</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="例如 0912345678"
          />
        </div>
        {msg && <div className="error-box">{msg}</div>}
        <button className="btn btn-green btn-block" disabled={busy}>{busy ? '查詢中…' : '查詢'}</button>
      </form>
      {orders.length > 0 && <section className="order-results">
        <h3>找到 {orders.length} 筆訂單</h3>
        {orders.map(order => <article className="order-result-card" key={order.id}>
          <div><span className="status-pill">{order.pickedUpAt ? '已取票' : '尚未取票'}</span><h3>{order.eventTitle}</h3><p>{order.eventDate}</p></div>
          <dl><dt>購票人</dt><dd>{order.buyerName}</dd><dt>票區／座位</dt><dd>{order.areaName} · {order.tickets.map(ticket => ticket.seat).join('、')}</dd><dt>金額</dt><dd>NT$ {((order.unitPrice || 0) * order.qty).toLocaleString()}</dd><dt>訂單序號</dt><dd className="order-code">{order.orderCode}</dd></dl>
          <button type="button" className="btn btn-orange btn-block" disabled={busy} onClick={() => void pickup(order)}>{order.pickedUpAt ? '再次開啟票券' : '取票'}</button>
        </article>)}
      </section>}
    </Shell>
  )
}
