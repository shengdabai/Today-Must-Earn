import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, powerMonitor } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import path from 'node:path'
import {
  getConfig, setConfig, getUnlocked, setUnlocked,
  getFocusSeconds, setFocusSeconds, maybeResetForNewDay,
  getLifetimeEarned, setLifetimeEarned,
  getLifetimeLessonIncome, recordLessonIncome,
} from './store'
import { FishMonitor } from './monitor'
import { computeEarnings } from './earnings'
import { countLessonsToday } from './calendar'
import { makeRoast } from './roast'
import { resolveAchievements } from '../src/data/achievements'
import type { AppSnapshot, Config } from '../src/lib/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const RENDERER_URL = new URL(VITE_DEV_SERVER_URL || pathToFileURL(path.join(RENDERER_DIST, 'index.html')).href).href
const PRELOAD = path.join(__dirname, 'preload.cjs') // CJS preload(见 vite.config.ts),沙箱渲染进程要求

let win: BrowserWindow | null = null
let tray: Tray | null = null
let monitor: FishMonitor
let workMode = true

// 运行期状态
let focusSeconds = 0
let lifetimeEarned = 0
let lifetimeLessonIncome = 0
let lessonsToday = 0
let monitorState: AppSnapshot['monitor'] = {
  status: 'working', idleSec: 0, activeApp: '启动中', switchCount: 0, permissionMissing: false,
}
let lastTick = Date.now()
let dirtySinceFlush = 0 // 距上次落盘累计的未持久化秒数
let suspended = false
let clockGeneration = 0

function createWindow() {
  const config = getConfig()
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const floating = config.overlayMode === 'floating'

  const createdWindow = new BrowserWindow({
    width: floating ? 360 : width,
    height: floating ? 232 : height, // 232 给 roast 文案留呼吸位(修审查 P0-1)
    x: floating ? width - 380 : 0,
    y: floating ? 40 : 0,
    frame: false,
    transparent: floating,
    resizable: true,
    alwaysOnTop: floating,
    skipTaskbar: floating,
    fullscreen: !floating,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win = createdWindow
  // 此窗口只展示本地应用;页面不能导航、开新窗口或取得浏览器权限。
  createdWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  createdWindow.webContents.on('will-frame-navigate', (e) => e.preventDefault())
  createdWindow.webContents.on('will-redirect', (e) => e.preventDefault())
  createdWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  createdWindow.webContents.session.setPermissionCheckHandler(() => false)
  createdWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  createdWindow.on('closed', () => {
    // 旧窗口可能在新窗口创建后才关闭,不能清掉新窗口的引用。
    if (win === createdWindow) win = null
  })

  if (floating) createdWindow.setAlwaysOnTop(true, 'screen-saver')

  // 窗口内容加载完成后主动推一帧完整快照(修审查 H4:切换/重建后立即有状态)
  createdWindow.webContents.on('did-finish-load', () => {
    createdWindow.webContents.send('money:snapshot', buildSnapshot())
  })

  if (VITE_DEV_SERVER_URL) {
    createdWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    createdWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createTray() {
  // 空图标 + 文字标题,保证菜单栏可见可点(修审查 L6)
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('💸')
  tray.setToolTip('今天也得赚钱')
  rebuildTrayMenu()
}

function rebuildTrayMenu() {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    {
      label: workMode ? '✅ 工作计时中(点我暂停)' : '⏸️ 已暂停(点我开工)',
      click: () => setWorkMode(!workMode),
    },
    { label: '👀 显示/召回窗口', click: showWindow },
    { type: 'separator' },
    {
      label: '悬浮窗模式',
      type: 'radio',
      checked: getConfig().overlayMode === 'floating',
      click: () => switchOverlay('floating'),
    },
    {
      label: '全屏大字报模式',
      type: 'radio',
      checked: getConfig().overlayMode === 'fullscreen',
      click: () => switchOverlay('fullscreen'),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
}

// 召回窗口:被关闭后从托盘重新打开(修审查 H5)
function showWindow() {
  if (!win || win.isDestroyed()) createWindow()
  else { win.show(); win.focus() }
}

function setWorkMode(on: boolean) {
  workMode = on
  clockGeneration++
  fishGeneration++
  lastTick = Date.now()
  rebuildTrayMenu()
}

function switchOverlay(mode: 'floating' | 'fullscreen') {
  setConfig({ overlayMode: mode })
  rebuildTrayMenu()
  const old = win
  win = null
  createWindow()
  if (old && !old.isDestroyed()) old.close()
}

// 专注时长降频落盘:每累计 ≥30s 或解锁成就时才写,退出时 flush(修审查 H6)
function syncDay(refresh = true) {
  if (!maybeResetForNewDay()) return
  focusSeconds = 0
  dirtySinceFlush = 0
  lessonsToday = 0
  lastTick = Date.now()
  if (refresh) void refreshCalendar().catch((err) => console.error('[calendar]', err))
}

function persistFocus(force = false, refresh = true) {
  // 退出/休眠可能发生在午夜后首个 tick 之前,写盘前同样需要跨天检查。
  syncDay(refresh)
  if (force || dirtySinceFlush >= 30) {
    setFocusSeconds(focusSeconds)
    setLifetimeEarned(lifetimeEarned)
    dirtySinceFlush = 0
  }
}

// 核心循环:每秒采样、计费、检测摸鱼、推送状态。可重入锁防慢调用堆叠(修审查 C1)
let ticking = false
async function tick() {
  if (ticking || suspended) return
  ticking = true
  const generation = clockGeneration
  try {
    syncDay()
    const config = getConfig()
    monitor.updateConfig(config)

    const state = await monitor.sample()
    // 采样期间系统可能休眠再唤醒;旧采样不能用于恢复后的计时。
    if (suspended || generation !== clockGeneration) return
    monitorState = state

    const now = Date.now()
    const elapsed = Math.max(0, (now - lastTick) / 1000)
    lastTick = now

    const perSecond = config.monthlySalary / (config.workdaysPerMonth * config.workHoursPerDay * 3600 || 1)

    // 仅在「工作模式 + 正在专注」时累计专注时长与生涯收入
    if (workMode && state.status === 'working') {
      focusSeconds += elapsed
      lifetimeEarned += perSecond * elapsed
      dirtySinceFlush += elapsed
      persistFocus()
    }

    const earnings = computeEarnings(config, focusSeconds, lessonsToday, lifetimeEarned, lifetimeLessonIncome)

    // 成就解锁:可能一次跨多个门槛,全部写入,最高那一个弹 toast(修审查 H2)
    const unlocked = getUnlocked()
    const { unlocked: list, newlyUnlocked } = resolveAchievements(earnings.focusMinutes, unlocked)
    if (newlyUnlocked.length) {
      setUnlocked(list.map((a) => a.id))
      persistFocus(true)
      const top = newlyUnlocked[newlyUnlocked.length - 1]
      win?.webContents.send('money:achievement', top.id)
    }

    const snapshot: AppSnapshot = {
      config,
      monitor: state,
      earnings,
      unlockedAchievements: list.map((a) => a.id),
      workMode,
    }
    win?.webContents.send('money:snapshot', snapshot)

    // AI 可等待 8 秒,不能持有采样锁或把这段摸鱼时间计入下一次专注。
    void maybeFishCaught(state.status, earnings.perMinute, state)
      .catch((err) => console.error('[roast]', err))
  } finally {
    ticking = false
  }
}

// 摸鱼吐槽节流:同一摸鱼状态最多每 20s 弹一次
let lastFishAt = 0
let lastFishStatus = ''
let fishGeneration = 0
let roastPending = false
async function maybeFishCaught(
  status: AppSnapshot['monitor']['status'],
  perMinute: number,
  state: AppSnapshot['monitor'],
) {
  if (status === 'working' || !workMode) {
    lastFishStatus = ''
    fishGeneration++
    return
  }
  if (roastPending) return
  const now = Date.now()
  const changed = status !== lastFishStatus
  if (!changed && now - lastFishAt < 20_000) return
  lastFishAt = now
  lastFishStatus = status

  const generation = ++fishGeneration
  roastPending = true
  try {
    const roast = await makeRoast(status, {
      min: Math.round(state.idleSec / 60) || 1,
      rate: perMinute,
      app: state.activeApp,
      count: state.switchCount,
    })
    if (generation === fishGeneration && workMode && !suspended && monitorState.status === status) {
      win?.webContents.send('money:fish', { status, roast })
    }
  } finally {
    roastPending = false
  }
}

let calendarRequest = 0
let lessonsContext = ''

function calendarContext(keyword: string): string {
  return JSON.stringify([new Date().toLocaleDateString('en-CA'), keyword])
}

async function refreshCalendar() {
  const request = ++calendarRequest
  const config = getConfig()
  const context = calendarContext(config.lessonKeyword)
  if (context !== lessonsContext) {
    lessonsToday = 0
    lessonsContext = context
  }
  const result = await countLessonsToday(config.lessonKeyword)
  // 丢弃旧查询及跨天/关键词已变的查询;同一天同一关键词失败才保留旧值。
  if (request !== calendarRequest || context !== calendarContext(getConfig().lessonKeyword)) return
  if (result.available) {
    lessonsToday = result.lessons
    lifetimeLessonIncome = recordLessonIncome(
      new Date().toLocaleDateString('en-CA'), lessonsToday * getConfig().lessonIncome,
    )
  }
}

function buildSnapshot(): AppSnapshot {
  syncDay()
  const config = getConfig()
  const earnings = computeEarnings(config, focusSeconds, lessonsToday, lifetimeEarned, lifetimeLessonIncome)
  const { unlocked } = resolveAchievements(earnings.focusMinutes, getUnlocked())
  return {
    config,
    monitor: monitorState,
    earnings,
    unlockedAchievements: unlocked.map((a) => a.id),
    workMode,
  }
}

// 参数净化不能代替来源校验;只允许当前窗口的应用主文档调用 IPC。
function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (!win || win.isDestroyed() || event.sender !== win.webContents ||
      !event.senderFrame || event.senderFrame !== win.webContents.mainFrame) return false
  try {
    const url = new URL(event.senderFrame.url)
    url.hash = ''
    return url.href === RENDERER_URL
  } catch {
    return false
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
}

// —— IPC(来源与入参均按不可信输入对待)——
function registerIpc() {
  ipcMain.handle('money:getSnapshot', (e) => { assertTrustedSender(e); return buildSnapshot() })
  ipcMain.handle('money:getConfig', (e) => { assertTrustedSender(e); return getConfig() })
  ipcMain.handle('money:setConfig', (e, patch: Partial<Config>) => {
    assertTrustedSender(e)
    const next = setConfig(patch) // setConfig 内部 sanitize
    clockGeneration++ // 旧采样不能继续按修改前的费率计时。
    fishGeneration++
    lastTick = Date.now()
    monitor.updateConfig(next)
    void refreshCalendar().catch((err) => console.error('[calendar]', err))
    return next
  })
  ipcMain.handle('money:setWorkMode', (e, on: unknown) => {
    assertTrustedSender(e)
    setWorkMode(on === true)
  })
  ipcMain.handle('money:setOverlayMode', (e, mode: unknown) => {
    assertTrustedSender(e)
    if (mode === 'floating' || mode === 'fullscreen') switchOverlay(mode)
  })
  ipcMain.on('money:quit', (e) => { if (isTrustedSender(e)) app.quit() })
}

app.whenReady().then(async () => {
  const config = getConfig()
  workMode = config.startupWorkMode
  focusSeconds = getFocusSeconds()
  lifetimeEarned = getLifetimeEarned()
  lifetimeLessonIncome = getLifetimeLessonIncome()
  monitor = new FishMonitor(config)

  registerIpc()
  createWindow()
  createTray()

  powerMonitor.on('suspend', () => {
    suspended = true
    clockGeneration++
    fishGeneration++
    persistFocus(true)
  })
  powerMonitor.on('resume', () => {
    suspended = false
    clockGeneration++
    lastTick = Date.now()
  })

  await refreshCalendar().catch((err) => console.error('[calendar]', err))
  // 每秒 tick / 每 5 分钟刷日历,async 回调都 catch 防 unhandledRejection(修审查 M3)
  setInterval(() => { tick().catch((err) => console.error('[tick]', err)) }, 1000)
  setInterval(() => { refreshCalendar().catch((err) => console.error('[calendar]', err)) }, 5 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 退出前 flush 专注时长,保证不丢数据(修审查 H6)
app.on('before-quit', () => persistFocus(true, false))

app.on('window-all-closed', () => {
  // 托盘常驻,不退出(macOS 习惯)。从托盘菜单「显示窗口」可召回,或「退出」结束。
  if (process.platform !== 'darwin') app.quit()
})
