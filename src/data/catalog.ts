export type FakeEvent = {
  id: string
  slug: string
  title: string
  subtitle: string
  category: 'concert' | 'exhibit' | 'sport' | 'theme' | 'party'
  venue: string
  dateText: string
  priceText: string
  status: 'coming' | 'onsale' | 'hot' | 'ended'
  badge?: string
  gradient: string
  blurb: string
  imageUrl?: string
  buyable?: boolean
}

export const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'concert', label: '展演活動' },
  { id: 'exhibit', label: '展覽' },
  { id: 'sport', label: '運動賽事' },
  { id: 'theme', label: '主題樂園' },
  { id: 'party', label: '派對專區' },
] as const

export const BANNERS = [
  { id: 'b1', title: 'SUMMER 夏日消暑 FUN 鬆玩', desc: '購買指定活動送舒跑（假的，送不到）', tone: 'orange' },
  { id: 'b2', title: 'AFTEE 新支付上線', desc: '先買後付（當然也是假的）', tone: 'green' },
  { id: 'b3', title: '熱賣中！熱門展覽推薦', desc: '點進去也不能買，別緊張', tone: 'blue' },
]

export const FAKE_EVENTS: FakeEvent[] = [
  {
    id: '39961',
    slug: '39961',
    title: 'MAMAPINK 2026 WORLD TOUR ＜1WARD＞ in TAIPEI',
    subtitle: '官方造型假頁（不可購票）',
    category: 'concert',
    venue: '南港巨蛋',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$1,800～$6,800',
    status: 'coming',
    badge: '即將開賣',
    gradient: 'linear-gradient(160deg,#3b0764 0%,#db2777 45%,#111827 100%)',
    blurb: '粉紅世界巡演台北站裝飾頁，點線上購票會被流量控管擋住。',
    imageUrl: '/decoys/mamapink.jpg',
  },
  {
    id: 'cwt73',
    slug: 'cwt-1314',
    title: 'CWT－1314 台灣同人誌販售會・台北場',
    subtitle: 'COMIC / DOJIN / GAME / COSPLAY',
    category: 'exhibit',
    venue: '台北世貿一館',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$450',
    status: 'hot',
    gradient: 'linear-gradient(160deg,#7f1d1d 0%,#dc2626 50%,#1c1917 100%)',
    blurb: '假的同人誌票券頁，僅供瀏覽氣氛。Love Create Together。',
    imageUrl: '/decoys/cwt1314.jpg',
  },
  {
    id: 'ultra',
    slug: 'ultra-heroes',
    title: '超人力霸主英雄展',
    subtitle: '瞬閃集結・再一次點燃',
    category: 'exhibit',
    venue: '華山1914文創園區',
    dateText: '2026/10/09（五）～10/11（日）',
    priceText: 'NT$450～$990',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#1e3a8a 0%,#2563eb 45%,#0f172a 100%)',
    blurb: '看起來很熱賣，但這場也不能真的買。',
    imageUrl: '/decoys/ultra-heroes.jpg',
  },
  {
    id: 'cpbl',
    slug: 'lions-final',
    title: '獅魂37年例行賽最終戰',
    subtitle: '統一獅魂・傳奇再起 ROAR FOR LIONS',
    category: 'sport',
    venue: '台南市立棒球場',
    dateText: '2026/10/09（五）～10/11（日）',
    priceText: 'NT$250～$1,200',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#9a3412 0%,#ea580c 40%,#431407 100%)',
    blurb: '假棒球賽事頁，進場請改去派對那場。',
    imageUrl: '/decoys/lions-roar.jpg',
  },
  {
    id: 'lego',
    slug: 'eda-fun-park',
    title: '高雄・義大歡樂世界',
    subtitle: '不只是樂園，是快樂補給站',
    category: 'theme',
    venue: '高雄義大世界',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$999（園區票）',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#0369a1 0%,#38bdf8 45%,#0c4a6e 100%)',
    blurb: '主題樂園假票頁，購買按鈕是裝飾。',
    imageUrl: '/decoys/eda-fun.jpg',
  },
  {
    id: 'violet',
    slug: 'violet-symphony',
    title: '紫羅蘭交響之夜音樂會 高雄站',
    subtitle: '讓音樂，替你說出還沒說的話',
    category: 'concert',
    venue: '高雄文化中心 至德堂',
    dateText: '2026/10/10（六）19:30～10/11（日）15:00',
    priceText: 'NT$1,600～$4,999',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#4c1d95 0%,#a78bfa 40%,#1e1b4b 100%)',
    blurb: '交響・動畫造型假頁，無法真的購票。',
    imageUrl: '/decoys/violet-symphony.jpg',
  },
  {
    id: 'ftisland',
    slug: 'pulse-island',
    title: '2026 海島脈動音樂祭',
    subtitle: 'PULSE ISLAND KAOHSIUNG MUSIC FESTIVAL',
    category: 'concert',
    venue: '高雄流行音樂中心・海音館',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$2,880～$6,580',
    status: 'ended',
    badge: '已結束',
    gradient: 'linear-gradient(160deg,#1e1b4b 0%,#7c3aed 40%,#0f172a 100%)',
    blurb: '已結束假頁，製造錯過焦慮用。',
    imageUrl: '/decoys/pulse-island.jpg',
  },
  {
    id: 'child',
    slug: 'kids-energy-park',
    title: '臺北・兒童放電樂園',
    subtitle: '玩具 × 遊戲 × 表演 × 大冒險',
    category: 'theme',
    venue: '臺北市兒童新樂園',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$180',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#ea580c 0%,#fbbf24 45%,#9a3412 100%)',
    blurb: '親子向假活動，無法結帳。',
    imageUrl: '/decoys/kids-park.jpg',
  },
  {
    id: 'museum',
    slug: 'chimei-time',
    title: '奇美時光探險・珍藏展',
    subtitle: '走進億萬年前的世界',
    category: 'exhibit',
    venue: '奇美博物館',
    dateText: '2026/10/10（六）～10/11（日）',
    priceText: 'NT$200',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#44403c 0%,#a8a29e 40%,#1c1917 100%)',
    blurb: '博物館假票，掃描也帶不進去。',
    imageUrl: '/decoys/chimei-time.jpg',
  },
]

export const FAKE_NEWS = [
  { id: 'n1', date: '2026/03/28', title: '【公告】系統維護通知（其實沒在維護）' },
  { id: 'n2', date: '2026/03/20', title: '【活動】花東振興 OPENPOINT 點數回饋（假的）' },
  { id: 'n3', date: '2026/03/12', title: '【提醒】開賣前請重新登入，避免登入逾時' },
  { id: 'n4', date: '2026/03/01', title: '【教學】如何和朋友一起玩 pbon 假搶票' },
]

export function getEventBySlug(slug: string) {
  return FAKE_EVENTS.find((e) => e.slug === slug || e.id === slug)
}
