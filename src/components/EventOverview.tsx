import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type EventOverviewProps = {
  title: string
  subtitle: string
  imageUrl?: string
  dateText: string
  venue: string
  priceText: string
  status: string
  saleText?: string
  countdown?: string
  notices?: string[]
  disabled?: boolean
  onBuy: () => void
  message?: string | null
}

function InfoSection({
  title,
  children,
  open = false,
}: {
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details className="event-info-section" open={open}>
      <summary>
        {title}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div>{children}</div>
    </details>
  )
}

export function EventOverview({
  title,
  subtitle,
  imageUrl,
  dateText,
  venue,
  priceText,
  status,
  saleText,
  countdown,
  notices = [],
  disabled,
  onBuy,
  message,
}: EventOverviewProps) {
  return (
    <article className="event-overview">
      <div className="detail-breadcrumb">
        <Link to="/">首頁</Link>
        <span>›</span>
        <span>節目資訊</span>
      </div>
      <div className="event-overview__hero">
        <div className="event-overview__poster">
          {imageUrl ? (
            <img src={imageUrl} alt={`${title} 活動海報`} />
          ) : (
            <div className="poster-fallback">{title}</div>
          )}
        </div>
        <div className="event-overview__intro">
          <span className="ticket-status">{status}</span>
          <h1>{title}</h1>
          <dl className="event-platform">
            <div>
              <dt>售票平台</dt>
              <dd>pbon 線上購票</dd>
            </div>
            <div>
              <dt>票券型態</dt>
              <dd>派對電子票券</dd>
            </div>
          </dl>
          <aside className="purchase-reminder">
            <strong>ⓘ 購票提醒</strong>
            <p>
              請於開賣前確認連線狀態。購票過程請勿重複送出，票券數量以系統確認結果為準。
            </p>
          </aside>
          {saleText && <p className="event-sale-time">開賣時間：{saleText}</p>}
          {countdown && (
            <p className="event-sale-time">
              距離開賣：<strong>{countdown}</strong>
            </p>
          )}
        </div>
      </div>
      <section className="event-sessions" aria-labelledby="session-title">
        <h2 id="session-title">場次購票</h2>
        <div className="session-head" aria-hidden="true">
          <span>演出 / 銷售日期</span>
          <span>場次名稱</span>
          <span>場地 / 地區</span>
          <span>購票</span>
        </div>
        <div className="session-entry">
          <div className="session-entry__date">
            <span className="session-mobile-label">演出時間</span>
            {dateText}
          </div>
          <div className="session-entry__title">{title}</div>
          <div className="session-entry__venue">
            <span className="session-mobile-label">演出地點</span>
            {venue}
          </div>
          <div className="session-entry__action">
            <button
              className="btn btn-green"
              type="button"
              disabled={disabled}
              onClick={onBuy}
            >
              {disabled ? '尚未開賣' : '線上購票'}
            </button>
            <span>{status}</span>
          </div>
        </div>
        {message && (
          <div className="error-box" role="status">
            {message}
          </div>
        )}
      </section>
      <InfoSection title="節目介紹" open>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
        <dl className="program-meta">
          <div>
            <dt>活動日期</dt>
            <dd>{dateText}</dd>
          </div>
          <div>
            <dt>活動地點</dt>
            <dd>{venue}</dd>
          </div>
          <div>
            <dt>票價</dt>
            <dd>{priceText}</dd>
          </div>
        </dl>
      </InfoSection>
      <InfoSection title="購票須知">
        <ul>
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>請確認場次、票區與張數後進行購票。</li>
          <li>訂單成立前不保證票券保留，請依系統顯示完成流程。</li>
          <li>本系統為派對娛樂模擬平台，付款請使用主辦提供的測試卡片。</li>
        </ul>
      </InfoSection>
      <InfoSection title="注意事項">
        <p>
          活動時間與派對安排請依主辦通知。本平台展示活動與票券沒有實際展演入場效力。
        </p>
      </InfoSection>
      <InfoSection title="退票規則">
        <p>模擬票券不涉及真實付款。如需取消派對遊戲訂單，請聯絡主辦人。</p>
      </InfoSection>
    </article>
  )
}
