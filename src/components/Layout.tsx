import { Link } from 'react-router-dom'
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
        <nav className="header-links">
          <Link to="/host">開房間</Link>
          <Link to="/join">加入</Link>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      pbon 派對售票系統 · 仿 ibon 介面的假搶票遊戲 · 僅供朋友派對娛樂使用
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
