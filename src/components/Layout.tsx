import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAccess } from '../lib/access'

export function DemoBanner() {
  return (
    <div className="demo-banner">本站為派對娛樂展示系統 · 票券無真實效力</div>
  )
}

export function Header() {
  const {status}=useAccess()
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark">PBON</span>
          <span className="brand__sub">派對系統</span>
        </Link>
        <nav className="header-links header-links--desktop">
          <NavLink to="/" end>
            節目資訊
          </NavLink>
          <NavLink to="/search">節目搜尋</NavLink>
          <NavLink to="/orders">訂單查詢</NavLink>
          <NavLink to="/news">公告</NavLink>
        </nav>
        <Link to={status?.member?'/account':'/account'} className="header-order">{status?.member?`你好，${status.member.name}`:'登入／註冊 →'}</Link>
      </div>
      <nav className="header-subnav">
        <NavLink to="/" end>
          首頁
        </NavLink>
        <NavLink to="/search?category=concert">展演</NavLink>
        <NavLink to="/search?category=exhibit">展覽</NavLink>
        <NavLink to="/search?category=sport">運動</NavLink>
        <NavLink to="/orders">訂單查詢</NavLink>
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <Link to="/">熱門活動</Link>
        <Link to="/news">消息公告</Link>
        <Link to="/orders">訂單查詢</Link>
        <Link to="/admin" className="footer-admin">
          後台
        </Link>
      </div>
      <p>PBON｜派對系統・票券無真實效力</p>
    </footer>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <Header />
      <main className="shell">{children}</main>
      <Footer />
    </>
  )
}

const STEPS = [
  '選擇活動',
  '選擇票區',
  '座位/數量',
  '填寫資訊',
  '購票確認',
  '訂票完成',
]

export function StepBar({ current }: { current: number }) {
  return (
    <div className="step-bar">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`step-bar__item ${i === current ? 'active' : ''}`}
        >
          <span className="step-bar__num">{i + 1}</span>
          {label}
        </div>
      ))}
    </div>
  )
}
