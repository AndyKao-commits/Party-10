import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoom, joinRoom } from '../api'
import { saveSession } from '../hooks/useRoom'
import { Shell } from '../components/Layout'

export function LandingPage() {
  return (
    <Shell>
      <div className="landing flash">
        <section className="landing-hero page-card">
          <div className="status-pill">PARTY DEMO</div>
          <h1>假的搶票系統</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 540, lineHeight: 1.7 }}>
            仿 ibon 售票活動頁與購票流程，給小派對跟朋友一起玩。倒數開賣、流量控管、搶票區、假取票序號——全部都是假的，就是好玩。
          </p>
          <div className="landing-actions">
            <Link className="btn btn-orange" to="/host">
              我是主辦 · 開房間
            </Link>
            <Link className="btn btn-green" to="/join">
              我有房間碼 · 加入搶票
            </Link>
          </div>
        </section>

        <section className="page-card notice-box">
          <h3>怎麼玩</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>主辦開房間，設定活動名稱、開賣倒數、票區庫存。</li>
            <li>朋友用房間碼加入，一起盯著活動頁倒數。</li>
            <li>開賣後狂按「線上購票」→ 排隊 → 選票區 → 搶！</li>
            <li>票有限，先搶先贏；忙線或售完也是派對的一部分。</li>
          </ol>
        </section>
      </div>
    </Shell>
  )
}

export function HostPage() {
  const nav = useNavigate()
  const [hostName, setHostName] = useState('主辦人')
  const [title, setTitle] = useState('PARTY HOUSE 2026 小派對 WORLD TOUR')
  const [subtitle, setSubtitle] = useState('＜FUN ONLY＞ in LIVING ROOM')
  const [venue, setVenue] = useState('你家客廳・派對主舞台')
  const [dateText, setDateText] = useState('今晚 20:00 開演（假的）')
  const [saleInSec, setSaleInSec] = useState(45)
  const [maxPerOrder, setMaxPerOrder] = useState(2)
  const [failChance, setFailChance] = useState(15)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { hostId, room } = await createRoom({
        hostName,
        title,
        subtitle,
        venue,
        dateText,
        saleInSec,
        maxPerOrder,
        failChance: failChance / 100,
        queueDelayMs: 2200,
      })
      saveSession({
        code: room.code,
        playerId: hostId,
        nickname: hostName,
        isHost: true,
        hostId,
      })
      nav(`/r/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form className="page-card host-panel flash" onSubmit={onCreate}>
        <h2 style={{ marginTop: 0 }}>開設搶票房間</h2>
        <p className="muted">設定好看一點，朋友進來會以為進了真的售票頁。</p>

        <div className="field">
          <label>你的暱稱</label>
          <input value={hostName} onChange={(e) => setHostName(e.target.value)} required />
        </div>
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
          <label>日期／時間文案</label>
          <input value={dateText} onChange={(e) => setDateText(e.target.value)} />
        </div>
        <div className="field">
          <label>幾秒後開賣（建議 30–60）</label>
          <input
            type="number"
            min={5}
            max={600}
            value={saleInSec}
            onChange={(e) => setSaleInSec(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>每筆限購張數</label>
          <input
            type="number"
            min={1}
            max={4}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>假忙線機率（%）：愈高愈像真的搶不到</label>
          <input
            type="number"
            min={0}
            max={60}
            value={failChance}
            onChange={(e) => setFailChance(Number(e.target.value))}
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="btn btn-orange btn-block" disabled={busy}>
          {busy ? '建立中…' : '建立房間並進入活動頁'}
        </button>
      </form>
    </Shell>
  )
}

export function JoinPage() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await joinRoom(code.trim().toUpperCase(), nickname || '訪客')
      saveSession({
        code: res.room.code,
        playerId: res.playerId,
        nickname: nickname || '訪客',
        isHost: false,
      })
      nav(`/r/${res.room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form className="page-card host-panel flash" onSubmit={onJoin}>
        <h2 style={{ marginTop: 0 }}>加入搶票房間</h2>
        <div className="field">
          <label>房間碼（6 碼）</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="例如 AB12CD"
            required
          />
        </div>
        <div className="field">
          <label>暱稱（搶到票會顯示）</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="你的名字" />
        </div>
        {error && <div className="error-box shake">{error}</div>}
        <button className="btn btn-green btn-block" disabled={busy}>
          {busy ? '進入中…' : '進入活動頁'}
        </button>
      </form>
    </Shell>
  )
}
