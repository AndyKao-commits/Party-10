import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export function DemoBanner() {
  return (
    <div className="demo-banner">
      假的 · 派對娛樂專用 · 無真實票務效力 · FAKE TICKETING FOR PARTY FUN ONLY
    </div>
  )
}

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark">pbon</span>
          <span className="brand__sub">派對售票系統</span>
        </Link>
        <nav className="header-links header-links--desktop">
          <NavLink to="/">熱門活動</NavLink>
          <NavLink to="/search?q=">詳細搜尋</NavLink>
          <NavLink to="/orders">訂單查詢</NavLink>
          <NavLink to="/news">公告</NavLink>
          <NavLink to="/host">主辦</NavLink>
        </nav>
      </div>
      <nav className="header-subnav">
        <NavLink to="/">首頁</NavLink>
        <NavLink to="/ActivityInfo/Details/party">派對購票</NavLink>
        <NavLink to="/search?q=演唱會">展演</NavLink>
        <NavLink to="/search?q=展覽">展覽</NavLink>
        <NavLink to="/search?q=棒球">運動</NavLink>
        <NavLink to="/orders">訂單</NavLink>
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
        <Link to="/host">主辦控制台</Link>
      </div>
      <p>票務客服專線：0800-000-000（假的）｜pbon 派對售票系統</p>
      <p>仿 ibon 介面的假搶票遊戲 · 僅供朋友派對娛樂使用</p>
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

const STEPS = ['選擇活動', '選擇票區', '座位/數量', '填寫資訊', '購票確認', '訂票完成']

export function StepBar({ current }: { current: number }) {
  return (
    <div className="step-bar">
      {STEPS.map((label, i) => (
        <div key={label} className={`step-bar__item ${i === current ? 'active' : ''}`}>
          <span className="step-bar__num">{i + 1}</span>
          {label}
        </div>
      ))}
    </div>
  )
}
