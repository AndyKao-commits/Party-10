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
    title: 'MAMAMOO 2026 WORLD TOUR ＜4WARD＞ in TAIPEI',
    subtitle: '官方造型假頁（不可購票）',
    category: 'concert',
    venue: '台北小巨蛋',
    dateText: '2026/08/22（六）',
    priceText: 'NT$1,800～$6,800',
    status: 'coming',
    badge: '即將開賣',
    gradient: 'linear-gradient(160deg,#3b0764 0%,#7c3aed 45%,#111827 100%)',
    blurb: '這是裝飾用假活動頁，點線上購票會被流量控管擋住。',
  },
  {
    id: 'cwt73',
    slug: 'cwt-73',
    title: 'CWT－73 台灣同人誌販售會．台北場．雙日票',
    subtitle: '全台 CWT 同人誌活動',
    category: 'exhibit',
    venue: '台北世貿一館',
    dateText: '2026/05/16～05/17',
    priceText: 'NT$450',
    status: 'hot',
    gradient: 'linear-gradient(160deg,#9a3412 0%,#ea580c 50%,#1c1917 100%)',
    blurb: '假的同人誌票券頁，僅供瀏覽氣氛。',
  },
  {
    id: 'ultra',
    slug: 'ultraman-exhibit',
    title: '超人力霸王英雄展',
    subtitle: '🖼️ ibon 熱賣中！熱門展覽推薦',
    category: 'exhibit',
    venue: '華山1914文創園區',
    dateText: '即日起～2026/06/30',
    priceText: 'NT$450～$990',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#1e3a8a 0%,#2563eb 45%,#0f172a 100%)',
    blurb: '看起來很熱賣，但這場也不能真的買。',
  },
  {
    id: 'cpbl',
    slug: 'cpbl-lions',
    title: '中華職棒37年例行賽統一獅主場',
    subtitle: '運動賽事專區',
    category: 'sport',
    venue: '台南市立棒球場',
    dateText: '2026/04～2026/10',
    priceText: 'NT$250～$1,200',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#14532d 0%,#22c55e 40%,#052e16 100%)',
    blurb: '假棒球賽事頁，進場請改去派對那場。',
  },
  {
    id: 'lego',
    slug: 'legoland-ticket',
    title: '高雄．義大遊樂世界',
    subtitle: '放假就玩主題樂園',
    category: 'theme',
    venue: '高雄義大世界',
    dateText: '即買即用（假的）',
    priceText: 'NT$999',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#0e7490 0%,#06b6d4 45%,#083344 100%)',
    blurb: '主題樂園假票頁，購買按鈕是裝飾。',
  },
  {
    id: 'violet',
    slug: 'violet-evergarden',
    title: '紫羅蘭永恆花園 交響音樂會 高雄站',
    subtitle: '交響・動畫・假票',
    category: 'concert',
    venue: '高雄文化中心 至德堂',
    dateText: '2026/01/11（日）15:00 / 19:30',
    priceText: 'NT$1,600～$4,999',
    status: 'ended',
    badge: '已結束',
    gradient: 'linear-gradient(160deg,#4c1d95 0%,#a78bfa 40%,#1e1b4b 100%)',
    blurb: '這場顯示已結束，點購票會提示無法購買。',
  },
  {
    id: 'ftisland',
    slug: 'ftisland-pulse',
    title: "2025 FTISLAND LIVE 'PULSE' THE FINAL IN KAOHSIUNG",
    subtitle: '演唱會造型假頁',
    category: 'concert',
    venue: '高雄流行音樂中心 海音館',
    dateText: '2025/04/12（六）',
    status: 'ended',
    priceText: 'NT$2,880～$6,580',
    badge: '售完',
    gradient: 'linear-gradient(160deg,#7f1d1d 0%,#ef4444 40%,#111827 100%)',
    blurb: '售完假頁，製造焦慮用。',
  },
  {
    id: 'child',
    slug: 'taipei-children-paradise',
    title: '臺北．兒童新樂園',
    subtitle: '夏日消暑 FUN 鬆玩',
    category: 'theme',
    venue: '臺北市兒童新樂園',
    dateText: '每日開放（假的）',
    priceText: 'NT$180',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#b45309 0%,#fbbf24 45%,#78350f 100%)',
    blurb: '親子向假活動，無法結帳。',
  },
  {
    id: 'museum',
    slug: 'chimei-museum',
    title: '奇美博物館．珍藏展．一般票',
    subtitle: '熱門展覽推薦',
    category: 'exhibit',
    venue: '奇美博物館',
    dateText: '即日起長期展出',
    priceText: 'NT$200',
    status: 'onsale',
    gradient: 'linear-gradient(160deg,#44403c 0%,#a8a29e 40%,#1c1917 100%)',
    blurb: '博物館假票，掃描也帶不進去。',
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
