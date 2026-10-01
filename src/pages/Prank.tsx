import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPrankAudio, startPrankAudio } from '../lib/prankAudio'

export function PrankPage() {
  const [playing,setPlaying] = useState(() => !getPrankAudio().paused)
  const [error,setError] = useState('')
  const stopTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(stopTimer.current)
    const audio=getPrankAudio()
    const onPlay=() => {setPlaying(true);setError('')}
    const onPause=() => setPlaying(false)
    const onError=() => {setPlaying(false);setError('音檔載入失敗，請重新整理再試。')}
    audio.addEventListener('play',onPlay);audio.addEventListener('pause',onPause);audio.addEventListener('ended',onPause);audio.addEventListener('error',onError)
    return () => {audio.removeEventListener('play',onPlay);audio.removeEventListener('pause',onPause);audio.removeEventListener('ended',onPause);audio.removeEventListener('error',onError);stopTimer.current=window.setTimeout(() => audio.pause(),0)}
  },[])
  return <main className="prank-screen">
    <div className="prank-warning" aria-hidden="true">⚠</div>
    <p className="prank-kicker">WARNING · WARNING</p>
    <h1>你的手機中毒了!</h1>
    <p className="prank-subtitle">你點進了神秘的購票頁面…</p>
    <div className="prank-player">
      <p role="status">{playing ? '正在播放神秘音效…' : '點下方按鈕播放音效'}</p>
      <button className="btn btn-orange btn-block" onClick={() => {
        if (playing) getPrankAudio().pause()
        else void startPrankAudio().catch(() => setError('目前無法播放，請再點一次播放按鈕。'))
      }}>{playing ? '暫停音效' : '播放音效 / 再聽一次'}</button>
      {error && <p role="alert">{error}</p>}
    </div>
    <p className="prank-reveal">這是派對惡作劇，你的手機沒有中毒 😈</p>
    <Link className="btn btn-ghost" to="/">回活動首頁</Link>
  </main>
}
