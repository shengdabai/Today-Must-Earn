import { powerMonitor } from 'electron'
import type { Config, FishStatus, MonitorState } from '../src/lib/types'

// 摸鱼检测器:
//  - idle: powerMonitor.getSystemIdleTime() 超阈值 → 发呆/离开
//  - entertainment: active-win 前台 app/标题 命中娱乐关键词
//  - switching: 近 60s 内前台切换次数过多
//  - working: 以上都不是,且有近期操作

// active-win 是可选原生依赖,缺失/无权限时降级(仅用 idle 检测)
type ActiveWinResult = {
  title?: string
  owner?: { name?: string }
  url?: string
} | undefined

let activeWin: (() => Promise<ActiveWinResult>) | null = null
async function loadActiveWin() {
  if (activeWin) return
  try {
    const mod = await import('active-win')
    activeWin = (mod.default ?? mod) as () => Promise<ActiveWinResult>
  } catch {
    activeWin = null
  }
}

const SWITCH_WINDOW_MS = 60_000
const SWITCH_THRESHOLD = 12 // 1 分钟切超过 12 次算「假装很忙」

export class FishMonitor {
  private config: Config
  private lastApp = ''
  private switchTimestamps: number[] = []
  private permissionMissing = false
  private activeQuery: Promise<ActiveWinResult> | null = null

  constructor(config: Config) {
    this.config = config
    void loadActiveWin()
  }

  updateConfig(config: Config) {
    this.config = config
  }

  private isEntertainment(app: string, title: string, url: string): boolean {
    const hay = `${app} ${title} ${url}`.toLowerCase()
    return this.config.entertainmentApps.some((k) =>
      typeof k === 'string' && k.trim().length > 0 && hay.includes(k.trim().toLowerCase()),
    )
  }

  private recordSwitch(app: string) {
    const now = Date.now()
    if (app && app !== this.lastApp) {
      this.switchTimestamps.push(now)
      this.lastApp = app
    }
    // 滑动窗口清理
    this.switchTimestamps = this.switchTimestamps.filter(
      (t) => now - t < SWITCH_WINDOW_MS,
    )
  }

  async sample(): Promise<MonitorState> {
    const idleSec = powerMonitor.getSystemIdleTime()

    let app = ''
    let title = ''
    let url = ''
    if (activeWin) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        // 加 800ms 超时:active-win 在系统繁忙/弹权限框时可能长挂,
        // 超时则按「未知前台」降级,绝不阻塞每秒 tick 循环(修审查 H1)
        // 超时不取消原生调用;复用未完成请求,避免每秒再启动一个。
        this.activeQuery ??= activeWin().finally(() => { this.activeQuery = null })
        const win = await Promise.race([
          this.activeQuery,
          new Promise<undefined>((resolve) => { timeout = setTimeout(() => resolve(undefined), 800) }),
        ])
        app = win?.owner?.name ?? ''
        title = win?.title ?? ''
        url = win?.url ?? ''
        // 未知前台/超时不能证明权限恢复,仅成功观察能清掉旧提示。
        if (win) this.permissionMissing = false
      } catch {
        // active-win 在 macOS 需屏幕录制权限,抛错通常=缺权限
        this.permissionMissing = true
      } finally {
        if (timeout !== undefined) clearTimeout(timeout)
      }
    } else {
      this.permissionMissing = true
    }

    // idle 期间不计切屏(避免发呆回来瞬间误判 switching,修审查 M6)
    this.recordSwitch(idleSec < this.config.idleThresholdSec ? app : '')
    const switchCount = this.switchTimestamps.length

    let status: FishStatus
    if (idleSec >= this.config.idleThresholdSec) {
      status = 'idle'
    } else if (app && this.isEntertainment(app, title, url)) {
      status = 'entertainment'
    } else if (app && switchCount >= SWITCH_THRESHOLD) {
      status = 'switching'
    } else {
      status = 'working'
    }

    return {
      status,
      idleSec,
      activeApp: app || (this.permissionMissing ? '(未授权检测)' : '未知'),
      switchCount,
      permissionMissing: this.permissionMissing,
    }
  }
}
