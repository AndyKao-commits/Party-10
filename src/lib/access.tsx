import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSiteStatus, joinRoom, loginMember, logoutMember, registerMember, verifyStaffAccess } from '../api'
import type { PartyMember, SiteStatus } from '../types'
import { loadSession, saveSession } from '../hooks/useRoom'

const MEMBER_KEY='pbon-member-token', STAFF_KEY='pbon-staff-token'
type AccessValue={status:SiteStatus|null;loading:boolean;memberToken:string;refresh:()=>Promise<void>;setMember:(token:string,member:PartyMember)=>void;signOut:()=>Promise<void>}
const AccessContext=createContext<AccessValue|null>(null)
const emptyStatus:SiteStatus={siteOpen:false,effectiveOpen:false,registrationOpen:true,purchaseOpen:false,closedMessage:'平台尚未開放，請洽活動方',staffAccess:false,member:null}

export function AccessProvider({children}:{children:ReactNode}) {
  const [status,setStatus]=useState<SiteStatus|null>(null)
  const [loading,setLoading]=useState(true)
  const [memberToken,setMemberTokenState]=useState(()=>localStorage.getItem(MEMBER_KEY)||'')
  const refresh=async()=>{
    try { const next=await getSiteStatus(localStorage.getItem(STAFF_KEY)||'',localStorage.getItem(MEMBER_KEY)||'');setStatus(next);if(!next.member&&localStorage.getItem(MEMBER_KEY)){localStorage.removeItem(MEMBER_KEY);setMemberTokenState('')} }
    catch { setStatus(s=>s||emptyStatus) }
    finally {setLoading(false)}
  }
  useEffect(()=>{void refresh();const id=window.setInterval(()=>void refresh(),30000);return()=>clearInterval(id)},[])
  const setMember=(token:string,member:PartyMember)=>{localStorage.setItem(MEMBER_KEY,token);setMemberTokenState(token);setStatus(s=>({...s||emptyStatus,member}))}
  const signOut=async()=>{const token=localStorage.getItem(MEMBER_KEY)||'';localStorage.removeItem(MEMBER_KEY);setMemberTokenState('');setStatus(s=>({...s||emptyStatus,member:null}));if(token) await logoutMember(token).catch(()=>{})}
  const value=useMemo(()=>({status,loading,memberToken,refresh,setMember,signOut}),[status,loading,memberToken])
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(){const value=useContext(AccessContext);if(!value)throw new Error('AccessProvider missing');return value}

export function AccessPanel({preregister=false}:{preregister?:boolean}) {
  const {status,setMember}=useAccess();const [mode,setMode]=useState<'register'|'login'>('register');const [name,setName]=useState('');const [phone,setPhone]=useState('');const [account,setAccount]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);const nav=useNavigate();const location=useLocation()
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const result=mode==='register'?await registerMember(name,phone,account):await loginMember(account,phone);setMember(result.token,result.member);setDone(true);if(!preregister){const next=new URLSearchParams(location.search).get('next');if(next)nav(next,{replace:true})}}catch(err){setError(err instanceof Error?err.message:'操作失敗')}finally{setBusy(false)}}
  if(done||status?.member)return <div className="access-success"><div className="status-pill">已登入</div><h3>預先登入完成</h3><p>活動開放後即可使用</p>{!preregister&&<button className="btn btn-green" onClick={()=>nav('/')}>回首頁</button>}</div>
  return <div className="access-panel"><div className="access-tabs"><button className={mode==='register'?'active':''} onClick={()=>setMode('register')} disabled={!status?.registrationOpen}>預先註冊</button><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>登入</button></div>
    <form onSubmit={submit}>{mode==='register'&&<div className="field"><label>名字</label><input value={name} onChange={e=>setName(e.target.value)} required maxLength={30}/></div>}<div className="field"><label>帳號</label><input value={account} onChange={e=>setAccount(e.target.value.toLowerCase().replace(/\s/g,''))} required autoCapitalize="none" placeholder="英文或數字"/></div><div className="field"><label>電話號碼（同時是登入密碼）</label><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,15))} required inputMode="tel" autoComplete="tel" placeholder="0912345678"/></div>{error&&<div className="error-box">{error}</div>}<button className="btn btn-green btn-block" disabled={busy||mode==='register'&&!status?.registrationOpen}>{busy?'處理中…':mode==='register'?'完成註冊並登入':'登入'}</button></form>
    {mode==='register'&&!status?.registrationOpen&&<p className="muted">目前未開放新會員註冊。</p>}
  </div>
}

export function MaintenancePage(){const {status,refresh}=useAccess();const [staff,setStaff]=useState(false);const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const unlock=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await verifyStaffAccess(password);localStorage.setItem(STAFF_KEY,r.token);await refresh()}catch(err){setError(err instanceof Error?err.message:'密碼錯誤')}finally{setBusy(false)}}
 return <main className="maintenance-page"><div className="maintenance-card"><div className="brand__mark">pbon</div><h1>{status?.closedMessage||'平台尚未開放，請洽活動方'}</h1><p className="muted">可以先完成註冊或登入，正式開放後即可直接使用。</p><AccessPanel preregister/></div><button className="staff-entry" onClick={()=>setStaff(v=>!v)}>工作人員進入</button>{staff&&<form className="staff-form" onSubmit={unlock}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="瀏覽密碼" autoFocus/><button className="btn btn-ghost" disabled={busy}>進入</button>{error&&<small>{error}</small>}</form>}</main>
}

export function SiteGate({children}:{children:ReactNode}){const {status,loading}=useAccess();const location=useLocation();if(location.pathname.startsWith('/admin'))return children;if(loading)return <div className="gate-loading"><div className="spinner"/></div>;if(!status?.effectiveOpen)return <MaintenancePage/>;return children}
function PlayerGate({children,member}:{children:ReactNode;member:PartyMember}){
 const {code=''}=useParams();const [ready,setReady]=useState(()=>{const current=loadSession();return current?.code===code&&!!current.playerId});const [error,setError]=useState('');const [attempt,setAttempt]=useState(0)
 useEffect(()=>{if(ready||!code)return;let active=true;const enter=async()=>{setError('');try{const current=loadSession();if(current?.code===code&&current.playerId){if(active)setReady(true);return}const result=await joinRoom(code,member.name);saveSession({code:result.room.code,playerId:result.playerId,nickname:member.name,isHost:false});if(active)setReady(true)}catch(err){if(active)setError(err instanceof Error?err.message:'進入活動失敗')}};void enter();return()=>{active=false}},[attempt,code,member.name,ready])
 if(error)return <div className="gate-loading"><div className="error-box">{error}</div><button className="btn btn-green" onClick={()=>setAttempt(value=>value+1)}>重新進入</button></div>
 if(!ready)return <div className="gate-loading"><div className="spinner"/><p>正在準備搶票…</p></div>
 return children
}

export function RequireMember({children}:{children:ReactNode}){const {status}=useAccess();const location=useLocation();if(!status?.member)return <Navigate to={`/account?next=${encodeURIComponent(location.pathname+location.search)}`} replace/>;if(!status.purchaseOpen)return <Navigate to="/" replace/>;return <PlayerGate member={status.member}>{children}</PlayerGate>}
