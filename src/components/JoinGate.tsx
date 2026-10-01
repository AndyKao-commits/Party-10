import { useState, type FormEvent } from 'react'
import { joinRoom } from '../api'
import { saveSession } from '../hooks/useRoom'

export function JoinGate({
  code,
  onJoined,
}: {
  code: string
  onJoined: () => void
}) {
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await joinRoom(code, nickname.trim() || '訪客')
      saveSession({
        code: res.room.code,
        playerId: res.playerId,
        nickname: nickname.trim() || '訪客',
        isHost: false,
      })
      onJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="join-overlay">
      <form className="page-card join-sheet flash" onSubmit={onSubmit}>
        <div className="status-pill">加入搶票</div>
        <h2 style={{ margin: '10px 0 6px' }}>房間 {code}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          輸入暱稱就能進活動頁一起搶（假的）。
        </p>
        <div className="field">
          <label>暱稱</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="你的名字"
            autoFocus
            autoComplete="nickname"
            enterKeyHint="go"
          />
        </div>
        {error && <div className="error-box shake">{error}</div>}
        <button className="btn btn-orange btn-block" disabled={busy}>
          {busy ? '進入中…' : '進入活動頁'}
        </button>
      </form>
    </div>
  )
}
