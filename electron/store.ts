import Store from 'electron-store'
import type { Config, Dream } from '../src/lib/types'

// 默认配置。月薪/币种以欧元为默认(用户是中文老师,收入欧元)。
export const DEFAULT_CONFIG: Config = {
  monthlySalary: 3000,
  currency: '€',
  workdaysPerMonth: 22,
  workHoursPerDay: 8,
  lessonKeyword: '中文课',
  lessonIncome: 20,
  idleThresholdSec: 90,
  entertainmentApps: [
    'YouTube', 'Bilibili', '哔哩哔哩', '抖音', 'TikTok', '微博', 'Weibo',
    '知乎', '小红书', 'Netflix', 'Twitch', 'Steam', '王者荣耀', 'Instagram',
    'Twitter', 'X', 'Reddit', '爱奇艺', '腾讯视频', '优酷', 'QQ音乐', '网易云',
  ],
  dreams: [
    { name: '说走就走的旅行', emoji: '🏝️', price: 3000 },
    { name: '一辆车', emoji: '🚗', price: 200000 },
    { name: '一套房的首付', emoji: '🏠', price: 600000 },
  ],
  overlayMode: 'floating',
  startupWorkMode: true,
}

interface Schema {
  config: Config
  unlockedAchievements: string[]
  lastFocusDate: string // YYYY-MM-DD,用于跨天重置
  focusSecondsToday: number
  lifetimeEarned: number // 生涯累计(月薪折算部分),跨天不清零
  lessonIncomeByDay: Record<string, number> // 仅记录日期与收入,不保存事件标题。
}

const store = new Store<Schema>({
  defaults: {
    config: DEFAULT_CONFIG,
    unlockedAchievements: [],
    lastFocusDate: '',
    focusSecondsToday: 0,
    lifetimeEarned: 0,
    lessonIncomeByDay: {},
  },
})

// —— 配置净化:IPC 与磁盘两个入口都过这里,保证内存里的 config 永远合法 ——
// 覆盖 NaN / 负数 / Infinity / 超大数 / 非数组 / 非法枚举(安全审查 M1+L4)
function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  if (typeof v !== 'number' && typeof v !== 'string') return dflt
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

function sanitizeDreams(v: unknown, base: Dream[]): Dream[] {
  if (!Array.isArray(v)) return base
  const cleaned = v
    .filter((d) => d && typeof d === 'object')
    .map((d: any) => ({
      name: typeof d.name === 'string' ? d.name.slice(0, 50) : '梦想',
      emoji: typeof d.emoji === 'string' ? d.emoji.slice(0, 8) : '✨',
      price: clampNum(d.price, 0, 1e12, 0),
    }))
  return cleaned.length ? cleaned : base
}

export function sanitizeConfig(patch: unknown, base: Config): Config {
  const p = patch && typeof patch === 'object' && !Array.isArray(patch)
    ? patch as Partial<Config> : {}
  const next: Config = { ...base }
  if ('monthlySalary' in p) next.monthlySalary = clampNum(p.monthlySalary, 0, 1e9, base.monthlySalary)
  if ('workdaysPerMonth' in p) next.workdaysPerMonth = clampNum(p.workdaysPerMonth, 1, 31, base.workdaysPerMonth)
  if ('workHoursPerDay' in p) next.workHoursPerDay = clampNum(p.workHoursPerDay, 1, 24, base.workHoursPerDay)
  if ('lessonIncome' in p) next.lessonIncome = clampNum(p.lessonIncome, 0, 1e7, base.lessonIncome)
  if ('idleThresholdSec' in p) next.idleThresholdSec = clampNum(p.idleThresholdSec, 10, 86400, base.idleThresholdSec)
  if (typeof p.currency === 'string' && p.currency.trim()) next.currency = p.currency.slice(0, 8)
  if (typeof p.lessonKeyword === 'string') next.lessonKeyword = p.lessonKeyword.slice(0, 100)
  if (Array.isArray(p.entertainmentApps))
    next.entertainmentApps = [...new Set(p.entertainmentApps.filter((s) => typeof s === 'string').map((s) => s.trim().toLowerCase().slice(0, 200)).filter(Boolean))].slice(0, 300)
  if ('dreams' in p) next.dreams = sanitizeDreams(p.dreams, base.dreams)
  if (p.overlayMode === 'floating' || p.overlayMode === 'fullscreen') next.overlayMode = p.overlayMode
  if (typeof p.startupWorkMode === 'boolean') next.startupWorkMode = p.startupWorkMode
  return next
}

export function getConfig(): Config {
  // 读磁盘也净化:防止用户手改 config.json 注入畸形值
  return sanitizeConfig(store.get('config') ?? {}, DEFAULT_CONFIG)
}

export function setConfig(patch: Partial<Config>): Config {
  const next = sanitizeConfig(patch, getConfig())
  store.set('config', next)
  return next
}

export function getUnlocked(): string[] {
  const v = store.get('unlockedAchievements')
  return Array.isArray(v) ? v : []
}

export function setUnlocked(ids: string[]): void {
  store.set('unlockedAchievements', ids)
}

// —— 日期 key:补零成 YYYY-MM-DD,稳定可比较 ——
function today(): string {
  // toLocaleDateString('en-CA') 产出 2026-06-05(本地时区)
  return new Date().toLocaleDateString('en-CA')
}

export function getFocusSeconds(): number {
  if (store.get('lastFocusDate') !== today()) return 0
  const value = store.get('focusSecondsToday')
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function setFocusSeconds(sec: number): void {
  store.set('lastFocusDate', today())
  store.set('focusSecondsToday', sec)
}

export function getLifetimeEarned(): number {
  const v = store.get('lifetimeEarned')
  return Number.isFinite(v) ? v : 0
}

export function setLifetimeEarned(v: number): void {
  store.set('lifetimeEarned', Number.isFinite(v) ? v : 0)
}

function lessonLedger(): Record<string, number> {
  const saved = store.get('lessonIncomeByDay')
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  return Object.fromEntries(Object.entries(saved).filter(([day, amount]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(amount) && amount >= 0,
  ))
}

export function getLifetimeLessonIncome(): number {
  return Object.values(lessonLedger()).reduce((sum, amount) => sum + amount, 0)
}

export function recordLessonIncome(day: string, amount: number): number {
  const ledger = lessonLedger()
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(amount) && amount >= 0) {
    // 同一天覆盖,不按刷新次数累加;整个账本一次写入,支持重启与日期回拨。
    if (ledger[day] !== amount) store.set('lessonIncomeByDay', { ...ledger, [day]: amount })
    ledger[day] = amount
  }
  return Object.values(ledger).reduce((sum, value) => sum + value, 0)
}

// 跨天:清空今日专注 + 成就,返回是否发生了重置(让主进程同步内存变量)。
// 生涯累计 lifetimeEarned 不清零。
export function maybeResetForNewDay(): boolean {
  if (store.get('lastFocusDate') !== today()) {
    store.set('focusSecondsToday', 0)
    store.set('unlockedAchievements', [])
    store.set('lastFocusDate', today())
    return true
  }
  return false
}
