import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getFeatured } from '../api'
import { Shell } from '../components/Layout'
import {
  BANNERS,
  CATEGORIES,
  FAKE_EVENTS,
  FAKE_NEWS,
  getEventBySlug,
  type FakeEvent,
} from '../data/catalog'

function statusLabel(e: FakeEvent) {
  if (e.buyable) return '熱賣中'
  if (e.status === 'ended') return '已結束'
  if (e.status === 'coming') return '即將開賣'
  if (e.status === 'hot') return '熱賣中'
  return '販售中'
}

export function CatalogHome() {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [featuredCode, setFeaturedCode] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    getFeatured()
      .then((r) => setFeaturedCode(r.room.code))
      .catch(() => setFeaturedCode(null))
  }, [])

  const list = useMemo(() => {
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

  const party = FAKE_EVENTS.find((e) => e.buyable)

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

        {party && (
          <section className="page-card featured-party">
            <div className="featured-party__tag">今日主打・唯一可購票</div>
            <div className="featured-party__grid">
              <div className="event-poster" style={{ background: party.gradient }}>
                <div className="poster__eyebrow">WORLD TOUR · FAKE</div>
                <h2 className="poster__title">{party.title}</h2>
                <div className="poster__sub">{party.subtitle}</div>
              </div>
              <div>
                <h2 className="activity-title" style={{ fontSize: 24 }}>
                  {party.title}
                </h2>
                <p className="muted">{party.blurb}</p>
                <ul className="meta-list">
                  <li>
                    <strong>場地</strong>
                    <span>{party.venue}</span>
                  </li>
                  <li>
                    <strong>時間</strong>
                    <span>{party.dateText}</span>
                  </li>
                  <li>
                    <strong>票價</strong>
                    <span>{party.priceText}</span>
                  </li>
                </ul>
                <div className="landing-actions">
                  <Link className="btn btn-orange" to="/ActivityInfo/Details/party">
                    查看活動／購票
                  </Link>
                  {featuredCode && (
                    <Link className="btn btn-green" to={`/r/${featuredCode}`}>
                      直接進入搶票場
                    </Link>
                  )}
                  <Link className="btn btn-ghost" to="/host">
                    主辦控制台
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="page-card">
          <div className="section-head">
            <h2>熱門活動推薦</h2>
            <span className="muted">大多不能買，專心搶派對那场就好</span>
          </div>
          <div className="event-grid">
            {list.map((e) => (
              <Link
                key={e.id}
                to={`/ActivityInfo/Details/${e.slug}`}
                className={`event-card ${e.buyable ? 'buyable' : ''}`}
              >
                <div className="event-card__art" style={{ background: e.gradient }}>
                  {(e.badge || e.buyable) && (
                    <span className="event-card__badge">{e.badge || '可購票'}</span>
                  )}
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
          {list.length === 0 && (
            <p className="notice-box muted">找不到節目，試試搜尋「派對」。</p>
          )}
        </section>

        <section className="page-card notice-box">
          <div className="section-head" style={{ marginBottom: 8 }}>
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
  const [featuredCode, setFeaturedCode] = useState<string | null>(null)

  useEffect(() => {
    if (event?.buyable) {
      getFeatured()
        .then((r) => setFeaturedCode(r.room.code))
        .catch(() => setFeaturedCode(null))
    }
  }, [event])

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
    if (event.buyable) {
      if (featuredCode) nav(`/r/${featuredCode}`)
      else nav('/host')
      return
    }
    if (event.status === 'ended') {
      setMsg('本活動已結束或售完，無法購票。請改看「派對專區」主打場次。')
      return
    }
    if (event.status === 'coming') {
      setMsg('尚未開賣。為避免開賣時登入逾時，請先去派對那場暖身。')
      return
    }
    setMsg('目前購票人數過多，系統流量控管中。請改購買今日主打派對場次。')
  }

  return (
    <Shell>
      <div className="page-card flash">
        <div className="hero-grid">
          <div className="event-poster tall" style={{ background: event.gradient }}>
            <div className="poster__eyebrow">
              {event.buyable ? 'PARTY ONLY' : 'DECOY EVENT'}
            </div>
            <h2 className="poster__title">{event.title}</h2>
            <div className="poster__sub">{event.subtitle}</div>
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className={`status-pill ${event.buyable ? 'hot' : ''}`}>
                {statusLabel(event)}
              </span>
              {!event.buyable && <span className="status-pill">展示用假頁</span>}
              {event.buyable && <span className="status-pill hot">唯一可購票</span>}
            </div>
            <h1 className="activity-title">{event.title}</h1>
            <p className="muted">{event.blurb}</p>
            <ul className="meta-list">
              <li>
                <strong>售票平台</strong>
                <span>pbon 派對機台、線上假購票</span>
              </li>
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
                <div className="sale-banner__label">
                  {event.buyable ? '這場可以搶！' : '這場不能買（裝飾用）'}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {event.buyable
                    ? '點線上購票進入派對搶票房間'
                    : '看起來很像真的，但結帳會失敗'}
                </div>
              </div>
              <button className="btn btn-orange buy-cta" type="button" onClick={onBuy}>
                線上購票
              </button>
            </div>
            {msg && <div className="error-box shake" style={{ marginTop: 12 }}>{msg}</div>}
          </div>
        </div>

        <div className="notice-box">
          <h3>購票須知</h3>
          <ol>
            <li>本站為派對娛樂用假售票系統，票券無真實效力。</li>
            <li>僅「PARTY HOUSE 小派對」場次開放真實搶票流程。</li>
            <li>其他活動頁面僅供瀏覽氣氛，無法成立訂單。</li>
            <li>每筆訂單限購張數以主辦設定為準。</li>
          </ol>
          {!event.buyable && (
            <p>
              想玩真的？去{' '}
              <Link to="/ActivityInfo/Details/party">派對主打場次</Link>
            </p>
          )}
        </div>
      </div>
    </Shell>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const results = FAKE_EVENTS.filter((e) => {
    const s = q.toLowerCase()
    return (
      e.title.toLowerCase().includes(s) ||
      e.venue.toLowerCase().includes(s) ||
      e.subtitle.toLowerCase().includes(s)
    )
  })

  return (
    <Shell>
      <div className="page-card notice-box flash">
        <h2 style={{ marginTop: 0 }}>搜尋結果：{q || '（空白）'}</h2>
        <p className="muted">共 {results.length} 筆（假資料）</p>
        <div className="event-grid">
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
        {results.length === 0 && <p>沒有結果。試試「派對」或「MAMAMOO」。</p>}
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
        <p className="muted">以上公告皆為氣氛用假訊息。</p>
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
              ? '查無訂單。若你剛搶到派對票，請回活動頁「搶票戰況」或成功頁截圖。'
              : '請輸入手機號碼',
          )
        }}
      >
        <h2 style={{ marginTop: 0 }}>訂單查詢</h2>
        <p className="muted">這頁是假的查詢介面，查不到真的金流訂單。</p>
        <div className="field">
          <label>手機號碼</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912345678"
            inputMode="tel"
          />
        </div>
        {msg && <div className="error-box">{msg}</div>}
        <button className="btn btn-green btn-block">查詢</button>
      </form>
    </Shell>
  )
}
