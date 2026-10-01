import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { joinUrl } from '../api'

export function SharePanel({ code }: { code: string }) {
  const url = joinUrl(code)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: '#006b34', light: '#ffffff' },
    }).then((data) => {
      if (!cancelled) setQr(data)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Fallback for older mobile browsers
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'pbon 派對搶票',
          text: `加入搶票房間 ${code}`,
          url,
        })
        return
      } catch {
        /* user cancelled */
      }
    }
    await copy()
  }

  return (
    <div className="share-panel">
      <div>
        <div className="sale-banner__label">手機掃碼加入</div>
        <div className="room-code" style={{ fontSize: 28, margin: '6px 0' }}>
          {code}
        </div>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13, wordBreak: 'break-all' }}>
          {url}
        </p>
        <div className="share-actions">
          <button type="button" className="btn btn-green" onClick={share}>
            分享給朋友
          </button>
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? '已複製！' : '複製連結'}
          </button>
        </div>
      </div>
      {qr && (
        <img className="share-qr" src={qr} alt={`房間 ${code} QR code`} width={160} height={160} />
      )}
    </div>
  )
}
