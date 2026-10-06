import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  adminOpenSale,
  adminClearMembers,
  adminDeleteMember,
  adminGetSiteSettings,
  adminListMembers,
  adminUpdateSiteSettings,
  cancelPurchaseRecord,
  createCards,
  clearPurchaseRecords,
  clearCards,
  createRoom,
  deleteRoom,
  listCards,
  listDecoys,
  listEvents,
  listPurchaseRecords,
  type PurchaseRecord,
  updateRoom,
  upsertDecoy,
  type LiveEvent,
} from '../api'
import { Shell } from '../components/Layout'
import { formatCardForShare, generateFakeCard, type FakeCard } from '../lib/cards'
import { exportAllCardImages, exportCardImage } from '../lib/cardExport'
import { fileToDataUrl } from '../lib/imageUpload'
import { saveSession } from '../hooks/useRoom'
import type { FakeEvent } from '../data/catalog'
import type { PartyMember } from '../types'

const ADMIN_KEY = 'pbon-admin'
const ADMIN_SESSION_KEY = 'pbon-admin-key'
const DEFAULT_PASS = 'party2026'

type Tab = 'settings' | 'members' | 'orders' | 'events' | 'decoys' | 'cards'

function expectedPassword() {
  return (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || DEFAULT_PASS
}

function setAdminLoggedIn(on: boolean, key='') {
  if (on) {localStorage.setItem(ADMIN_KEY, '1');sessionStorage.setItem(ADMIN_SESSION_KEY,key)}
  else {localStorage.removeItem(ADMIN_KEY);sessionStorage.removeItem(ADMIN_SESSION_KEY)}
}

function isAdminLoggedIn() {
  try {
    return localStorage.getItem(ADMIN_KEY) === '1' && !!sessionStorage.getItem(ADMIN_SESSION_KEY)
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
  const [members,setMembers]=useState<PartyMember[]>([])
  const [memberFilter,setMemberFilter]=useState('')
  const [siteSettings,setSiteSettings]=useState({siteOpen:false,registrationOpen:true,purchaseOpen:false,closedMessage:'平台尚未開放，請洽活動方',staffPassword:''})
  const [records,setRecords]=useState<PurchaseRecord[]>([])
  const [recordFilter,setRecordFilter]=useState('')
  const [recordEvent,setRecordEvent]=useState('all')
  const [recordError,setRecordError]=useState('')
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
    try {const result=await listPurchaseRecords();setRecords(result.orders);setRecordError('')}
    catch(err) {setRecordError(err instanceof Error ? err.message : '購票紀錄載入失敗')}
    setEvents(ev.events)
    setDecoys(de.events)
    setCards(ca.cards)
    const adminKey=sessionStorage.getItem(ADMIN_SESSION_KEY)||''
    if(adminKey){
      const [settings,memberResult]=await Promise.all([adminGetSiteSettings(adminKey),adminListMembers(adminKey)])
      setSiteSettings(s=>({...s,...settings,staffPassword:''}));setMembers(memberResult.members)
    }
  }

  useEffect(() => {
    if (authed) void refresh()
  }, [authed])

  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== expectedPassword()) {
      setLoginError('密碼錯誤')
      return
    }
    try {
      await adminGetSiteSettings(password)
      setAdminLoggedIn(true,password)
      setAuthed(true)
      setLoginError(null)
    } catch {
      setLoginError('後台密碼與資料庫設定不一致，請確認環境設定')
    }
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

  const hostForEvent = (code: string) => events.find((event) => event.code === code)?.hostId || ''

  const cancelOrder = async (order: PurchaseRecord) => {
    if (!window.confirm(`確定取消 ${order.nickname} 的訂單？\n${order.areaName}：${order.seats.join('、')}\n座位會重新開放購買。`)) return
    setBusy(true)
    setError(null)
    try {
      await cancelPurchaseRecord(order.id, hostForEvent(order.eventCode))
      setMsg('訂單已取消，座位已重新釋出')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消訂單失敗')
    } finally {
      setBusy(false)
    }
  }

  const clearOrders = async () => {
    const targets = recordEvent === 'all' ? events.filter((event) => records.some((order) => order.eventCode === event.code)) : events.filter((event) => event.code === recordEvent)
    if (!targets.length) return
    const label = recordEvent === 'all' ? `全部 ${records.length} 筆購票紀錄` : `「${targets[0].title}」的全部購票紀錄`
    if (!window.confirm(`確定清除${label}？\n所有真座位都會重新開放購買。`)) return
    setBusy(true)
    setError(null)
    try {
      const results = await Promise.all(targets.map((event) => clearPurchaseRecords(event.code, event.hostId || '')))
      const removed = results.reduce((sum, result) => sum + result.removed, 0)
      setMsg(`已清除 ${removed} 筆購票紀錄，座位已重新釋出`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '清除購票紀錄失敗')
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
              ['settings','網站開關'],
              ['members','註冊會員'],
              ['orders', '購票紀錄'],
              ['decoys', '假活動'],
              ['cards', '假信用卡'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`admin-tab ${tab === id ? 'active' : ''}`}
              onClick={() => {setTab(id); if (id === 'orders') void refresh()}}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="error-box">{error}</div>}
        {msg && <div className="status-pill" style={{ margin: '8px 0' }}>{msg}</div>}

        {tab === 'orders' && <section className="page-card notice-box">
          <div className="admin-top"><h3>購票紀錄</h3><button className="btn btn-ghost" disabled={busy} onClick={() => void refresh()}>重新整理</button></div>
          <p className="muted">只有成功買到真座位的訂單會列在這裡。取消或清除後，座位會重新開放購買。</p>
          <div className="field"><label htmlFor="order-event">活動</label><select id="order-event" value={recordEvent} onChange={e => setRecordEvent(e.target.value)}><option value="all">全部活動</option>{events.map(e => <option key={e.code} value={e.code}>{e.title}（{e.code}）</option>)}</select></div>
          <div className="field"><label htmlFor="order-search">搜尋購票人、票區、座位或訂單</label><input id="order-search" value={recordFilter} onChange={e => setRecordFilter(e.target.value)} placeholder="輸入姓名、座位或訂單編號"/></div>
          {recordError ? <div role="alert" className="error-box">{recordError}</div> : (() => {
            const filtered=records.filter(o => (recordEvent === 'all' || recordEvent === o.eventCode) && [o.nickname,o.areaName,o.code,o.eventTitle,...o.seats].join(' ').toLowerCase().includes(recordFilter.trim().toLowerCase()))
            return <><div className="record-summary"><p>成功訂單 {filtered.length} 筆 · 共 {filtered.reduce((n,o) => n+o.qty,0)} 張</p>{records.length > 0 && <button type="button" className="btn btn-danger" disabled={busy || (recordEvent !== 'all' && !filtered.length)} onClick={() => void clearOrders()}>{recordEvent === 'all' ? '清除全部紀錄' : '清除此活動紀錄'}</button>}</div>{filtered.length === 0 ? <p className="muted">{records.length ? '沒有符合條件的訂單' : '目前還沒有成功購票紀錄'}</p> : filtered.map(o => <article className="purchase-record" key={o.id}>
              <div className="purchase-record-head"><strong>{o.nickname}</strong><span className="status-pill">購票成功</span></div>
              <p>{o.eventTitle} <small>（{o.eventCode}）</small></p>
              <dl><dt>票區 / 張數</dt><dd>{o.areaName} · {o.qty} 張</dd><dt>座位</dt><dd>{o.seats.join('、')}</dd><dt>成交金額</dt><dd>{o.unitPrice == null ? '舊訂單未記錄金額' : `NT$ ${(o.unitPrice*o.qty).toLocaleString()}`}</dd><dt>購票時間</dt><dd>{new Date(o.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</dd><dt>取票序號</dt><dd className="order-code">{o.code}</dd></dl>
              <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => void cancelOrder(o)}>取消此訂單並釋出座位</button>
            </article>)}</>
          })()}
        </section>}
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
            <div className="admin-top">
              <h3 style={{ marginTop: 0 }}>假信用卡</h3>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || cards.length === 0}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await exportAllCardImages(cards)
                    setMsg(`已匯出 ${cards.length} 張卡片，共 ${Math.ceil(cards.length / 8)} 組 A4 正反面圖片`)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '批量匯出失敗')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                匯出 A4 排版
              </button>
            </div>
            <p className="muted">
              每張都有卡號、持卡人、有效期限、三碼安全碼與正反面。A4 排版每頁 8 張，滿版自動換頁，並附雙面列印對位背面。
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
                <article key={c.id} className="fake-card-item">
                  <div className="fake-card-pair">
                    <div className="fake-card fake-card--front">
                      <div className="fake-card__brand"><strong>PARTY BANK</strong><em>{c.cardNumber.replace(/\D/g, '').startsWith('5') ? 'MASTERCARD' : 'VISA'}</em></div>
                      <div className="fake-card__chip" aria-hidden="true" />
                      <div className="fake-card__num">{c.cardNumber}</div>
                      <div className="fake-card__meta">
                        <span><small>CARD HOLDER</small>{c.holder}</span>
                        <span><small>VALID THRU</small>{c.expMonth}/{c.expYear}</span>
                      </div>
                      <div className="fake-card__demo">DEMO · NOT VALID</div>
                    </div>
                    <div className="fake-card fake-card--back">
                      <div className="fake-card__stripe" />
                      <small>AUTHORIZED SIGNATURE</small>
                      <div className="fake-card__signature"><span>{c.holder}</span><b>{c.cvv}</b></div>
                      <p>此卡僅供私人派對遊戲使用，無付款功能。</p>
                      <div className="fake-card__back-foot"><strong>PARTY BANK</strong><span>DEMO · NOT VALID</span></div>
                    </div>
                  </div>
                  <div className="fake-card-item__title">{c.label || c.holder}</div>
                  <div className="share-actions">
                    <button
                      type="button"
                      className="btn btn-orange"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        setError(null)
                        try {
                          await exportCardImage(c)
                          setMsg(`已匯出 ${c.label || c.holder} 的正反面圖片`)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : '圖片匯出失敗')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      匯出正反面圖片
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
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
                      分享／複製
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab==='settings'&&<section className="page-card host-panel"><h3 style={{marginTop:0}}>網站開放設定</h3><p className="muted">網站、註冊與購票可以分開控制。工作人員仍可從暫停頁輸入瀏覽密碼。</p>
          <label className="admin-switch"><input type="checkbox" checked={siteSettings.siteOpen} onChange={e=>setSiteSettings(s=>({...s,siteOpen:e.target.checked}))}/><span><strong>網站開放</strong><small>關閉時顯示暫停頁</small></span></label>
          <label className="admin-switch"><input type="checkbox" checked={siteSettings.registrationOpen} onChange={e=>setSiteSettings(s=>({...s,registrationOpen:e.target.checked}))}/><span><strong>開放註冊</strong><small>暫停期間也能預先註冊</small></span></label>
          <label className="admin-switch"><input type="checkbox" checked={siteSettings.purchaseOpen} onChange={e=>setSiteSettings(s=>({...s,purchaseOpen:e.target.checked}))}/><span><strong>開放購票</strong><small>會員才能進入選位與結帳</small></span></label>
          <div className="field"><label>暫停頁文字</label><input value={siteSettings.closedMessage} onChange={e=>setSiteSettings(s=>({...s,closedMessage:e.target.value}))}/></div>
          <div className="field"><label>新的工作人員瀏覽密碼（留空不修改）</label><input type="password" value={siteSettings.staffPassword} onChange={e=>setSiteSettings(s=>({...s,staffPassword:e.target.value}))} placeholder="至少 4 碼"/></div>
          <button className="btn btn-green btn-block" disabled={busy} onClick={async()=>{if(!confirm('確定套用網站開放設定？'))return;setBusy(true);setError(null);try{const key=sessionStorage.getItem(ADMIN_SESSION_KEY)||'';await adminUpdateSiteSettings(key,siteSettings);setSiteSettings(s=>({...s,staffPassword:''}));setMsg('網站設定已更新')}catch(err){setError(err instanceof Error?err.message:'更新失敗')}finally{setBusy(false)}}}>儲存網站設定</button>
        </section>}

        {tab==='members'&&<section className="page-card host-panel"><div className="admin-top"><h3 style={{marginTop:0}}>註冊會員</h3><button className="btn btn-ghost" onClick={()=>void refresh()}>重新整理</button></div><div className="field"><label>搜尋名字、電話或帳號</label><input value={memberFilter} onChange={e=>setMemberFilter(e.target.value)} placeholder="搜尋會員"/></div>
          <div className="record-summary"><p>目前 {members.length} 位會員 · {members.filter(m=>(m.orderCount||0)>0).length} 位已購票</p><div className="share-actions"><button className="btn btn-ghost" disabled={busy||!members.length} onClick={async()=>{if(!confirm('清除所有尚未購票的會員？'))return;await adminClearMembers(sessionStorage.getItem(ADMIN_SESSION_KEY)||'','unpurchased');await refresh();setMsg('已清除未購票會員')}}>清除未購票</button><button className="btn btn-danger" disabled={busy||!members.length} onClick={async()=>{const full=confirm('按「確定」會完整重置會員、訂單與座位。\n按「取消」則只清除會員資料。');const mode=full?'full':'members';if(!confirm(full?'再次確認：所有訂單會刪除並釋回座位。':'確認清除全部會員？訂單快照會保留。'))return;await adminClearMembers(sessionStorage.getItem(ADMIN_SESSION_KEY)||'',mode);await refresh();setMsg(full?'已完成新活動完整重置':'已清除全部會員')}}>清除全部／完整重置</button></div></div>
          <div className="member-list">{members.filter(m=>[m.name,m.phone,m.account].join(' ').toLowerCase().includes(memberFilter.toLowerCase())).map(m=><article className="member-row" key={m.id}><div><strong>{m.name}</strong><span>@{m.account}</span><span>{m.phone}</span><small>{new Date(m.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})} · 訂單 {m.orderCount||0} 筆</small></div><button className="btn btn-ghost" disabled={busy} onClick={async()=>{if(!confirm(`刪除 ${m.name} 的註冊資料？`))return;await adminDeleteMember(sessionStorage.getItem(ADMIN_SESSION_KEY)||'',m.id);await refresh();setMsg('會員已刪除')}}>刪除</button></article>)}</div>
        </section>}

        <p style={{ textAlign: 'center' }}>
          <Link to="/">回售票首頁</Link>
        </p>
      </div>
    </Shell>
  )
}
