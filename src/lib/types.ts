// 主进程 <-> 渲染层 共享类型

export interface Config {
  monthlySalary: number // 月薪
  currency: string // 币种符号
  workdaysPerMonth: number // 每月工作天数
  workHoursPerDay: number // 每天工作小时
  lessonKeyword: string // 日历里「中文课」的关键词
  lessonIncome: number // 一节课收入
  idleThresholdSec: number // 多久无操作算摸鱼
  entertainmentApps: string[] // 娱乐 app / 网站关键词
  dreams: Dream[] // 财富梦想目标
  overlayMode: 'floating' | 'fullscreen' // 显示模式
  startupWorkMode: boolean // 启动即进入工作计时
}

export interface Dream {
  name: string
  emoji: string
  price: number // 目标金额(同币种)
}

export type FishStatus = 'working' | 'idle' | 'entertainment' | 'switching'

export interface MonitorState {
  status: FishStatus
  idleSec: number // 当前空闲秒数
  activeApp: string // 当前前台 app
  switchCount: number // 近 1 分钟切屏次数
  permissionMissing: boolean // 缺少屏幕录制/辅助功能权限
}

export interface EarningsState {
  perMinute: number // 每分钟收入
  perSecond: number // 每秒收入
  salaryEarnedToday: number // 月薪折算今日已赚(按专注时长)
  lessonsToday: number // 今日日历里的课数
  lessonIncomeToday: number // 课程收入
  totalToday: number // 今日合计
  focusMinutes: number // 今日累计专注分钟
  todayTarget: number // 今日目标
  lifetimeTotal: number // 生涯累计赚到的钱(跨天累积,用于财富进度条)
}

export interface AppSnapshot {
  config: Config
  monitor: MonitorState
  earnings: EarningsState
  unlockedAchievements: string[]
  workMode: boolean // 当前是否在工作计时
}

// 渲染层暴露的 API(preload 注入到 window.money)
export interface MoneyAPI {
  getSnapshot: () => Promise<AppSnapshot>
  getConfig: () => Promise<Config>
  setConfig: (patch: Partial<Config>) => Promise<Config>
  setWorkMode: (on: boolean) => Promise<void>
  setOverlayMode: (mode: 'floating' | 'fullscreen') => Promise<void>
  quit: () => void
  onSnapshot: (cb: (s: AppSnapshot) => void) => () => void
  onFishCaught: (cb: (p: { status: FishStatus; roast: string }) => void) => () => void
  onAchievement: (cb: (id: string) => void) => () => void
}

declare global {
  interface Window {
    money: MoneyAPI
  }
}
