import { AccessPanel, useAccess } from '../lib/access'
import { Shell } from '../components/Layout'

export function AccountPage(){const {status,signOut}=useAccess();return <Shell><div className="page-card host-panel">{status?.member?<><h2>我的帳號</h2><dl className="account-details"><dt>名字</dt><dd>{status.member.name}</dd><dt>帳號</dt><dd>{status.member.account}</dd><dt>電話</dt><dd>{status.member.phone}</dd></dl><button className="btn btn-ghost" onClick={()=>void signOut()}>登出</button></>:<><h2>會員登入</h2><AccessPanel/></>}</div></Shell>}
