import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { claimFeaturedHost, createRoom, getFeatured, joinRoom, resetStock } from '../api'
import { saveSession } from '../hooks/useRoom'
import { Shell } from '../components/Layout'

export function HostPage() {
  const nav = useNavigate()
  const [hostName, setHostName] = useState('主辦人')
  const [saleInSec, setSaleInSec] = useState(45)
  const [featuredCode, setFeaturedCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'featured' | 'custom'>('featured')

  useEffect(() => {
    getFeatured()
      .then((r) => setFeaturedCode(r.room.code))
      .catch(() => setFeaturedCode(''))
  }, [])

  const onClaimFeatured = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { hostId, room } = await claimFeaturedHost(hostName)
      saveSession({
        code: room.code,
        playerId: hostId,
        nickname: hostName,
        isHost: true,
        hostId,
      })
      await resetStock(room.code, hostId, saleInSec)
      nav(`/r/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得主辦權失敗')
    } finally {
      setBusy(false)
    }
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { hostId, room } = await createRoom({
        hostName,
        saleInSec,
        maxPerOrder: 2,
        failChance: 0.15,
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
      <div className="page-card host-panel flash">
        <h2 style={{ marginTop: 0 }}>主辦控制台</h2>
        <p className="muted">
          首頁只有「派對主打場」能買票。建議直接接管該場，朋友從首頁點進去即可。
          {featuredCode ? `（房間碼 ${featuredCode}）` : ''}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${mode === 'featured' ? 'btn-green' : 'btn-ghost'}`}
            onClick={() => setMode('featured')}
          >
            接管首頁主打場
          </button>
          <button
            type="button"
            className={`btn ${mode === 'custom' ? 'btn-green' : 'btn-ghost'}`}
            onClick={() => setMode('custom')}
          >
            另開隱藏房間
          </button>
        </div>

        <form onSubmit={mode === 'featured' ? onClaimFeatured : onCreate}>
          <div className="field">
            <label>你的暱稱</label>
            <input value={hostName} onChange={(e) => setHostName(e.target.value)} required />
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
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-orange btn-block" disabled={busy}>
            {busy
              ? '處理中…'
              : mode === 'featured'
                ? '接管主打場並進入'
                : '建立隱藏房間'}
          </button>
        </form>

        <p style={{ marginTop: 16 }}>
          <Link to="/ActivityInfo/Details/party">查看首頁主打活動頁</Link>
          {' · '}
          <Link to="/">回售票首頁</Link>
        </p>
      </div>
    </Shell>
  )
}

export function JoinPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => (params.get('code') || '').toUpperCase())
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = (params.get('code') || '').toUpperCase()
    if (fromQuery) setCode(fromQuery)
  }, [params])

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
        <p className="muted">掃 QR 或貼連結進來後，填暱稱就能搶。</p>
        <div className="field">
          <label>房間碼（6 碼）</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="例如 AB12CD"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            required
          />
        </div>
        <div className="field">
          <label>暱稱（搶到票會顯示）</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="你的名字"
            autoComplete="nickname"
            enterKeyHint="go"
            autoFocus={Boolean(code)}
          />
        </div>
        {error && <div className="error-box shake">{error}</div>}
        <button className="btn btn-green btn-block" disabled={busy}>
          {busy ? '進入中…' : '進入活動頁'}
        </button>
      </form>
    </Shell>
  )
}
