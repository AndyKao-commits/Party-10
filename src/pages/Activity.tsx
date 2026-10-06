import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { openSale, resetStock } from '../api'
import { JoinGate } from '../components/JoinGate'
import { Shell } from '../components/Layout'
import { SharePanel } from '../components/SharePanel'
import { useCountdown } from '../hooks/useCountdown'
import { loadSession, useRoom } from '../hooks/useRoom'
import { useAccess } from '../lib/access'

export function ActivityPage() {
  const { code = '' } = useParams()
  const { room, error, connected } = useRoom(code)
  const [session, setSession] = useState(() => loadSession())
  const { label, done } = useCountdown(room?.saleAt)
  const [tab, setTab] = useState<'info' | 'buy' | 'board'>('info')
  const nav = useNavigate()
  const {status}=useAccess()
  const inRoom = session?.code === code
  const isHost = inRoom && session.isHost && !!session.hostId
  const needsJoin = Boolean(room) && !inRoom

  const totalLeft = useMemo(
    () => room?.areas.reduce((s, a) => s + a.remaining, 0) ?? 0,
    [room],
  )

  if (error) {
    return (
      <Shell>
        <div className="page-card notice-box">
          <div className="error-box">{error}</div>
          <p>
            <Link to="/join">重新加入</Link>
          </p>
        </div>
      </Shell>
    )
  }

  if (!room) {
    return (
      <Shell>
        <div className="queue-screen page-card">
          <div className="spinner" />
          <p className="pulse">載入活動資訊中…</p>
        </div>
      </Shell>
    )
  }

  const saleOpen = room.saleOpen || done

  return (
    <Shell>
      {needsJoin && (
        <JoinGate
          code={code}
          onJoined={() => setSession(loadSession())}
        />
      )}
      <div className="page-card flash">
        <div className="hero-grid">
          <div className="detail-poster">
            {room.imageUrl ? <img src={room.imageUrl} alt={room.title} /> : <div className="poster-fallback">{room.title}</div>}
          </div>

          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className={`status-pill ${saleOpen ? 'hot' : ''}`}>
                {saleOpen ? '熱賣中 / 搶票中' : '即將開賣'}
              </span>
              <span className="status-pill">{connected ? '即時連線' : '重連中…'}</span>
              <span className="status-pill">房間 {room.code}</span>
            </div>

            <h1 className="activity-title">{room.title}</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              {room.subtitle}
            </p>

            <ul className="meta-list">
              <li>
                <strong>售票平台</strong>
                <span>pbon 派對機台、線上假購票</span>
              </li>
              <li>
                <strong>票券型態</strong>
                <span>假紙券（螢幕截圖可當戰利品）</span>
              </li>
              <li>
                <strong>演出時間</strong>
                <span>{room.dateText}</span>
              </li>
              <li>
                <strong>演出地點</strong>
                <span>{room.venue}</span>
              </li>
              <li>
                <strong>剩餘總票</strong>
                <span>
                  {totalLeft} / {room.areas.reduce((s, a) => s + a.total, 0)}（線上即時）
                </span>
              </li>
            </ul>

            <div className="sale-banner">
              <div>
                <div className="sale-banner__label">
                  {saleOpen ? '已開賣！立刻點線上購票' : '距離開賣還有'}
                </div>
                {!saleOpen && <div className="countdown">{label}</div>}
                {saleOpen && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    為避免開賣時登入逾時，請保持本頁開啟
                  </div>
                )}
              </div>
              <button
                className="btn btn-orange buy-cta"
                disabled={!saleOpen || needsJoin || !status?.purchaseOpen}
                onClick={() => nav(`/r/${code}/queue`)}
              >
                {!status?.purchaseOpen ? '購票尚未開放' : saleOpen ? '線上購票' : '尚未開賣'}
              </button>
            </div>

            {isHost && (
              <>
                <div className="host-actions">
                  <button
                    className="btn btn-green"
                    onClick={() => session?.hostId && openSale(code, session.hostId)}
                  >
                    立刻開賣
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => session?.hostId && resetStock(code, session.hostId, 20)}
                  >
                    重置庫存並倒數 20 秒
                  </button>
                  <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                    在線 {room.playerCount} 人 · 已成交 {room.orderCount} 筆
                  </span>
                </div>
                <SharePanel code={room.code} />
              </>
            )}
          </div>
        </div>

        {saleOpen && !needsJoin && status?.purchaseOpen && (
          <div className="mobile-buy-bar">
            <button className="btn btn-orange btn-block" onClick={() => nav(`/r/${code}/queue`)}>
              線上購票 · 立刻搶
            </button>
          </div>
        )}

        <div className="tabs">
          <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
            活動介紹
          </button>
          <button className={tab === 'buy' ? 'active' : ''} onClick={() => setTab('buy')}>
            場次購票
          </button>
          <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}>
            搶票戰況
          </button>
        </div>

        {tab === 'info' && (
          <div className="notice-box">
            <h3>節目介紹</h3>
            <p>
              這不是真的售票網站。這是給小派對用的假搶票遊戲，介面刻意做成類似 ibon
              活動頁的感覺：海報、場次、線上購票、流量控管、票區與假取票序號。
            </p>
            <h3>注意事項（假的）</h3>
            <ul>
              {room.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>每筆訂單限購 {room.maxPerOrder} 張。</li>
              <li>開賣瞬間可能出現「購票人數過多」，請重新再試——這是功能不是 bug。</li>
            </ul>
          </div>
        )}

        {tab === 'buy' && (
          <div style={{ padding: 16 }}>
            <table className="session-table">
              <thead>
                <tr>
                  <th>場次</th>
                  <th>地點</th>
                  <th>狀態</th>
                  <th>購票</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{room.dateText}</td>
                  <td>{room.venue}</td>
                  <td>{saleOpen ? '熱賣中' : '即將開賣'}</td>
                  <td>
                    <button
                      className="btn btn-orange"
                      disabled={!saleOpen || !status?.purchaseOpen}
                      onClick={() => nav(`/r/${code}/queue`)}
                    >
                      線上購票
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>票價區域示意</h3>
            <div className="price-map">
              {room.areas.map((a) => (
                <div key={a.id} className="price-chip">
                  <div className="price-chip__swatch" style={{ background: a.color }} />
                  <strong>{a.name}</strong>
                  <span>NT$ {a.price.toLocaleString()}</span>
                  <span className="muted">剩 {a.remaining}/{a.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'board' && (
          <div className="leaderboard">
            {room.orders.length === 0 ? (
              <p className="muted">還沒有人搶到票。開賣後戰況會即時更新。</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>暱稱</th>
                    <th>票區</th>
                    <th>張數</th>
                    <th>座位</th>
                  </tr>
                </thead>
                <tbody>
                  {room.orders.map((o, i) => (
                    <tr key={o.id}>
                      <td>{i + 1}</td>
                      <td>{o.nickname}</td>
                      <td>{o.areaName}</td>
                      <td>{o.qty}</td>
                      <td>{o.seats.join('、')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
