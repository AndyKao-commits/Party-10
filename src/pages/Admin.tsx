import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  adminOpenSale,
  createCards,
  clearCards,
  createRoom,
  deleteRoom,
  listCards,
  listDecoys,
  listEvents,
  updateRoom,
  upsertDecoy,
  type LiveEvent,
} from '../api'
import { Shell } from '../components/Layout'
import { formatCardForShare, generateFakeCard, type FakeCard } from '../lib/cards'
import { fileToDataUrl } from '../lib/imageUpload'
import { saveSession } from '../hooks/useRoom'
import type { FakeEvent } from '../data/catalog'

const ADMIN_KEY = 'pbon-admin'
const DEFAULT_PASS = 'party2026'

type Tab = 'events' | 'decoys' | 'cards'

function expectedPassword() {
  return (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || DEFAULT_PASS
}

function setAdminLoggedIn(on: boolean) {
  if (on) localStorage.setItem(ADMIN_KEY, '1')
  else localStorage.removeItem(ADMIN_KEY)
}

function isAdminLoggedIn() {
  try {
    return localStorage.getItem(ADMIN_KEY) === '1'
  } catch {
    return false
  }
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyEventForm = () => ({
  code: '',
  hostId: '',
  title: '下班烤肉派對',
  subtitle: '好朋友限定・屋頂炭火之夜',
  venue: '屋頂派對主場',
  dateText: '2026/10/11（日）16:00',
  saleAt: toLocalInputValue(new Date('2026-10-10T10:00:00')),
  maxPerOrder: 2,
  failChance: 15,
  featured: true,
  areas: [{ id: 'general', name: '烤肉席', price: 700, realSeats: 18, fakeSeats: 18, color: '#16a34a' }],
  imageUrl: '/events/bbq-party.jpg',
})

export function AdminPage() {
  const [authed, setAuthed] = useState(isAdminLoggedIn)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [decoys, setDecoys] = useState<FakeEvent[]>([])
  const [cards, setCards] = useState<FakeCard[]>([])
  const [form, setForm] = useState(emptyEventForm)
  const [editing, setEditing] = useState(false)
  const [decoyForm, setDecoyForm] = useState<FakeEvent | null>(null)
  const [cardCount, setCardCount] = useState(15)
  const [cardPrefix, setCardPrefix] = useState('嘉賓')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const refresh = async () => {
    const [ev, de, ca] = await Promise.all([
      listEvents().catch(() => ({ events: [] as LiveEvent[] })),
      listDecoys().catch(() => ({ events: [] as FakeEvent[] })),
      listCards().catch(() => ({ cards: [] as FakeCard[] })),
    ])
    setEvents(ev.events)
    setDecoys(de.events)
    setCards(ca.cards)
  }

  useEffect(() => {
    if (authed) void refresh()
  }, [authed])

  const onLogin = (e: FormEvent) => {
    e.preventDefault()
    if (password === expectedPassword()) {
      setAdminLoggedIn(true)
      setAuthed(true)
      setLoginError(null)
    } else setLoginError('密碼錯誤')
  }

  const onSaveEvent = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const saleDate = new Date(form.saleAt)
      if (Number.isNaN(saleDate.getTime())) throw new Error('開賣時間格式不正確')
      if (editing && form.code) {
        await updateRoom({
          code: form.code,
          hostId: form.hostId || null,
          title: form.title,
          subtitle: form.subtitle,
          venue: form.venue,
          dateText: form.dateText,
          saleAt: saleDate.toISOString(),
          maxPerOrder: form.maxPerOrder,
          failChance: form.failChance / 100,
          featured: form.featured,
          areas: form.areas,
          imageUrl: form.imageUrl,
        })
        setMsg(`已更新 ${form.code}`)
      } else {
        const { hostId, room } = await createRoom({
          hostName: '主辦',
          title: form.title,
          subtitle: form.subtitle,
          venue: form.venue,
          dateText: form.dateText,
          saleAt: saleDate.toISOString(),
          maxPerOrder: form.maxPerOrder,
          failChance: form.failChance / 100,
          queueDelayMs: 2200,
          featured: form.featured,
          areas: form.areas,
          imageUrl: form.imageUrl,
        })
        saveSession({
          code: room.code,
          playerId: hostId,
          nickname: '主辦',
          isHost: true,
          hostId,
        })
        setMsg(`已建立 ${room.code}`)
      }
      setEditing(false)
      setForm(emptyEventForm())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (ev: LiveEvent) => {
    setEditing(true)
    setForm({
      code: ev.code,
      hostId: ev.hostId || '',
      title: ev.title,
      subtitle: ev.subtitle,
      venue: ev.venue,
      dateText: ev.dateText,
      saleAt: toLocalInputValue(new Date(ev.saleAt)),
      maxPerOrder: ev.maxPerOrder || 2,
      failChance: Math.round((ev.failChance ?? 0.15) * 100),
      featured: ev.featured,
      areas: (ev.areas || []).map(a => ({ id: a.id, name: a.name, price: a.price, realSeats: a.realSeats, fakeSeats: a.fakeSeats, color: a.color })),
      imageUrl: ev.imageUrl || '',
    })
    setTab('events')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onPickImage = async (
    file: File | undefined,
    apply: (url: string) => void,
  ) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      apply(await fileToDataUrl(file))
      setMsg('圖片已載入，記得按儲存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '圖片處理失敗')
    } finally {
      setBusy(false)
    }
  }

  if (!authed) {
    return (
      <Shell>
        <form className="page-card host-panel flash" onSubmit={onLogin}>
          <h2 style={{ marginTop: 0 }}>後台登入</h2>
          <div className="field">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {loginError && <div className="error-box">{loginError}</div>}
          <button className="btn btn-green btn-block">登入</button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="admin-mobile flash">
        <div className="admin-top">
          <h2 style={{ margin: 0 }}>後台</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAdminLoggedIn(false)
              setAuthed(false)
            }}
          >
            登出
          </button>
        </div>

        <div className="admin-tabs">
          {(
            [
              ['events', '活動'],
              ['decoys', '假活動'],
              ['cards', '假信用卡'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`admin-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="error-box">{error}</div>}
        {msg && <div className="status-pill" style={{ margin: '8px 0' }}>{msg}</div>}

        {tab === 'events' && (
          <>
            <form className="page-card host-panel" onSubmit={onSaveEvent}>
              <h3 style={{ marginTop: 0 }}>{editing ? `編輯 ${form.code}` : '建立活動'}</h3>
              <div className="field">
                <label>活動名稱</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>副標</label>
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>地點</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>日期文案</label>
                <input
                  value={form.dateText}
                  onChange={(e) => setForm((f) => ({ ...f, dateText: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>開賣時間</label>
                <input
                  type="datetime-local"
                  value={form.saleAt}
                  onChange={(e) => setForm((f) => ({ ...f, saleAt: e.target.value }))}
                  required
                />
              </div>
              <h3>票區與座位</h3>
              <p className="muted">真假座位隨機混排。調整數量會重新排列未售座位，已售座位與訂單保留；真座位數不得少於已售張數。</p>
              {form.areas.map((area, index) => (
                <fieldset className="admin-seat-area" key={area.id}>
                  <legend>票區 {index + 1}</legend>
                  <div className="field"><label>票區名稱</label><input value={area.name} required onChange={e => setForm(f => ({ ...f, areas: f.areas.map((a,i) => i === index ? {...a,name:e.target.value} : a) }))}/></div>
                  <div className="field-row">
                    {(['price','realSeats','fakeSeats'] as const).map(key => <div className="field" key={key}>
                      <label>{key === 'price' ? '票價 NT$' : key === 'realSeats' ? '真座位數' : '假座位數'}</label>
                      <input type="number" min={0} max={key === 'price' ? 999999 : 999} required value={area[key]} onChange={e => setForm(f => ({...f,areas:f.areas.map((a,i) => i === index ? {...a,[key]:Number(e.target.value)} : a)}))}/>
                    </div>)}
                  </div>
                  <div className="field"><label>票區顏色</label><input type="color" value={area.color} onChange={e => setForm(f => ({...f,areas:f.areas.map((a,i) => i === index ? {...a,color:e.target.value} : a)}))}/></div>
                  {form.areas.length > 1 && <button type="button" className="btn btn-ghost" onClick={() => setForm(f => ({...f,areas:f.areas.filter((_,i) => i !== index)}))}>移除票區</button>}
                </fieldset>
              ))}
              <button type="button" className="btn btn-ghost" onClick={() => setForm(f => ({...f,areas:[...f.areas,{id:crypto.randomUUID(),name:'新票區',price:700,realSeats:10,fakeSeats:10,color:'#16a34a'}]}))}>新增票區</button>
              <div className="field-row">
                <div className="field"><label>每筆限購</label><input type="number" min={1} max={4} required value={form.maxPerOrder} onChange={e => setForm(f => ({...f,maxPerOrder:Number(e.target.value)}))}/></div>
                <div className="field"><label>假忙線 %</label><input type="number" min={0} max={60} required value={form.failChance} onChange={e => setForm(f => ({...f,failChance:Number(e.target.value)}))}/></div>
              </div>
              <div className="field">
                <label>海報圖片網址</label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="/events/yawasabi-super-planet.jpg 或 https://..."
                />
              </div>
              <div className="field">
                <label>或上傳海報</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    void onPickImage(e.target.files?.[0], (url) =>
                      setForm((f) => ({ ...f, imageUrl: url })),
                    )
                  }
                />
              </div>
              {form.imageUrl && (
                <img src={form.imageUrl} alt="活動海報預覽" className="decoy-preview" />
              )}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                />
                設為首頁主打
              </label>
              <div className="share-actions">
                {editing && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditing(false)
                      setForm(emptyEventForm())
                    }}
                  >
                    取消編輯
                  </button>
                )}
                <button className="btn btn-orange" style={{ flex: 1 }} disabled={busy}>
                  {busy ? '儲存中…' : editing ? '更新活動' : '建立並上架'}
                </button>
              </div>
            </form>

            <section className="page-card notice-box">
              <h3 style={{ marginTop: 0 }}>已上架活動</h3>
              <div className="admin-event-list">
                {events.map((ev) => (
                  <div key={ev.code} className="admin-event-row">
                    <div>
                      <strong>
                        {ev.title} {ev.featured ? '★' : ''}
                      </strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {ev.code} · 剩 {ev.remaining ?? '?'} / {ev.totalTickets ?? '?'} ·{' '}
                        {new Date(ev.saleAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <div className="share-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => startEdit(ev)}>
                        編輯
                      </button>
                      <button
                        type="button"
                        className="btn btn-green"
                        onClick={async () => {
                          try {
                            await adminOpenSale(ev.code)
                            setMsg(`${ev.code} 已開賣`)
                            await refresh()
                          } catch (err) {
                            setError(err instanceof Error ? err.message : '開賣失敗')
                          }
                        }}
                      >
                        開賣
                      </button>
                      <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
                        if (!window.confirm(`確定永久刪除「${ev.title}」？座位、訂單及活動資料都會刪除。`)) return
                        setBusy(true); setError(null)
                        try { await deleteRoom(ev.code, ev.hostId || ''); if (form.code === ev.code) {setEditing(false);setForm(emptyEventForm())}; setMsg('活動已刪除'); await refresh() }
                        catch (err) {setError(err instanceof Error ? err.message : '刪除失敗')}
                        finally {setBusy(false)}
                      }}>刪除</button>
                      <button type="button" className="btn btn-ghost" onClick={() => nav(`/r/${ev.code}`)}>
                        進入
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'decoys' && (
          <>
            <section className="page-card notice-box">
              <h3 style={{ marginTop: 0 }}>假活動列表</h3>
              <p className="muted">這些不會真的賣票，可改標題／文案／圖片網址，避免跟真活動撞臉。</p>
              <div className="admin-event-list">
                {decoys.map((d) => (
                  <div key={d.id} className="admin-event-row">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {d.imageUrl ? (
                        <img src={d.imageUrl} alt="" className="decoy-thumb" />
                      ) : (
                        <div className="decoy-thumb" style={{ background: d.gradient }} />
                      )}
                      <div>
                        <strong>{d.title}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {d.slug} · {d.status}
                        </div>
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={() => setDecoyForm({ ...d })}>
                      編輯
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {decoyForm && (
              <form
                className="page-card host-panel"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setError(null)
                  try {
                    await upsertDecoy({ ...decoyForm })
                    setMsg('假活動已更新')
                    setDecoyForm(null)
                    await refresh()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '更新失敗')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <h3 style={{ marginTop: 0 }}>編輯假活動</h3>
                <div className="field">
                  <label>標題</label>
                  <input
                    value={decoyForm.title}
                    onChange={(e) => setDecoyForm({ ...decoyForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>副標</label>
                  <input
                    value={decoyForm.subtitle}
                    onChange={(e) => setDecoyForm({ ...decoyForm, subtitle: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>地點</label>
                  <input
                    value={decoyForm.venue}
                    onChange={(e) => setDecoyForm({ ...decoyForm, venue: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>日期文案</label>
                  <input
                    value={decoyForm.dateText}
                    onChange={(e) => setDecoyForm({ ...decoyForm, dateText: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>票價文案</label>
                  <input
                    value={decoyForm.priceText}
                    onChange={(e) => setDecoyForm({ ...decoyForm, priceText: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>狀態</label>
                  <select
                    value={decoyForm.status}
                    onChange={(e) =>
                      setDecoyForm({
                        ...decoyForm,
                        status: e.target.value as FakeEvent['status'],
                      })
                    }
                  >
                    <option value="coming">即將開賣</option>
                    <option value="onsale">販售中</option>
                    <option value="hot">熱賣中</option>
                    <option value="ended">已結束</option>
                  </select>
                </div>
                <div className="field">
                  <label>介紹文</label>
                  <textarea
                    rows={3}
                    value={decoyForm.blurb}
                    onChange={(e) => setDecoyForm({ ...decoyForm, blurb: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>圖片網址（可貼 Imgur / 雲端圖床）</label>
                  <input
                    value={decoyForm.imageUrl || ''}
                    onChange={(e) => setDecoyForm({ ...decoyForm, imageUrl: e.target.value })}
                    placeholder="https://... 或 /decoys/xxx.jpg"
                  />
                </div>
                <div className="field">
                  <label>或上傳照片</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void onPickImage(e.target.files?.[0], (url) =>
                        setDecoyForm({ ...decoyForm, imageUrl: url }),
                      )
                    }
                  />
                </div>
                {decoyForm.imageUrl && (
                  <img src={decoyForm.imageUrl} alt="preview" className="decoy-preview" />
                )}
                <div className="share-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setDecoyForm(null)}>
                    取消
                  </button>
                  <button className="btn btn-orange" style={{ flex: 1 }} disabled={busy}>
                    儲存假活動
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {tab === 'cards' && (
          <section className="page-card host-panel">
            <h3 style={{ marginTop: 0 }}>假信用卡</h3>
            <p className="muted">
              隨機產生卡號、有效月年、四碼安全碼。分給現場的人，結帳時必須輸入正確才過。
            </p>
            <div className="field-row">
              <div className="field">
                <label>張數</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>名牌前綴</label>
                <input value={cardPrefix} onChange={(e) => setCardPrefix(e.target.value)} />
              </div>
            </div>
            <div className="share-actions" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-orange"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    const batch = Array.from({ length: cardCount }, (_, i) =>
                      generateFakeCard(`${cardPrefix}${i + 1}`),
                    )
                    const res = await createCards(
                      batch.map((c) => ({
                        label: c.label,
                        holder: c.holder,
                        cardNumber: c.cardNumber,
                        expMonth: c.expMonth,
                        expYear: c.expYear,
                        cvv: c.cvv,
                      })),
                    )
                    setCards(res.cards)
                    setMsg(`已產生 ${batch.length} 張假卡`)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '產生失敗（請先執行 schema-v2.sql）')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                產生假卡
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  if (!confirm('清除全部假卡？')) return
                  const res = await clearCards()
                  setCards(res.cards)
                  setMsg('已清除假卡')
                }}
              >
                清空
              </button>
            </div>

            <div className="card-list">
              {cards.map((c) => (
                <article key={c.id} className="fake-card">
                  <div className="fake-card__label">{c.label || c.holder}</div>
                  <div className="fake-card__num">{c.cardNumber}</div>
                  <div className="fake-card__meta">
                    <span>
                      {c.expMonth}/{c.expYear}
                    </span>
                    <span>CVV {c.cvv}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={async () => {
                      const text = formatCardForShare(c)
                      try {
                        if (navigator.share) await navigator.share({ text, title: '派對假信用卡' })
                        else {
                          await navigator.clipboard.writeText(text)
                          setMsg('已複製假卡資訊')
                        }
                      } catch {
                        await navigator.clipboard.writeText(text)
                        setMsg('已複製假卡資訊')
                      }
                    }}
                  >
                    分享／複製給這個人
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <p style={{ textAlign: 'center' }}>
          <Link to="/">回售票首頁</Link>
        </p>
      </div>
    </Shell>
  )
}
