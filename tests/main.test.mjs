import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { deferred, loadTypeScript, settle } from './helpers/runtime.mjs'

async function mainRuntime({ devServerURL, packaged = false } = {}) {
  let now = new Date('2026-10-29T12:00:00+08:00').getTime()
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const config = {
    monthlySalary: 3000, currency: '€', workdaysPerMonth: 22, workHoursPerDay: 8,
    lessonKeyword: '中文课', lessonIncome: 20, idleThresholdSec: 90,
    entertainmentApps: [], dreams: [], overlayMode: 'floating', startupWorkMode: true,
  }
  const intervals = new Map()
  const handlers = new Map()
  const windows = []
  const errors = []
  let resetDay = false
  let calendarRead = async () => ({ lessons: 2, available: true })
  let roastRead = async () => 'Local test roast'
  let monitorState = {
    status: 'working', idleSec: 0, activeApp: 'Test editor', switchCount: 0, permissionMissing: false,
  }
  let monitorRead = async () => monitorState
  let savedFocus = 0
  const lessonLedger = {}
  const app = new EventEmitter()
  const powerMonitor = new EventEmitter()
  app.whenReady = () => Promise.resolve()
  app.isPackaged = packaged
  let quitCalls = 0
  app.quit = () => { quitCalls++ }
  class Window extends EventEmitter {
    destroyed = false
    messages = []
    webContents = new EventEmitter()
    constructor(options) {
      super()
      this.options = options
      this.webContents.mainFrame = { url: '' }
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler }
      this.webContents.session = {
        setPermissionCheckHandler: (handler) => { this.checkPermission = handler },
        setPermissionRequestHandler: (handler) => { this.requestPermission = handler },
      }
      this.webContents.send = (...args) => {
        if (this.destroyed) throw new Error('Object has been destroyed')
        this.messages.push(args)
      }
      windows.push(this)
    }
    loadFile(file) { this.loadURL(pathToFileURL(file).href) }
    loadURL(url) {
      this.webContents.mainFrame.url = url
      this.webContents.emit('did-finish-load')
    }
    isDestroyed() { return this.destroyed }
    close() { this.destroyed = true; this.emit('closed') }
    setAlwaysOnTop() {}
    show() {}
    focus() {}
    static getAllWindows() { return windows.filter((win) => !win.destroyed) }
  }
  class Tray {
    setTitle() {}
    setToolTip() {}
    setContextMenu() {}
  }
  loadTypeScript('electron/main.ts', {
    electron: {
      app, BrowserWindow: Window, Tray, powerMonitor,
      ipcMain: { handle: (name, callback) => handlers.set(name, callback), on: (name, callback) => handlers.set(name, callback) },
      Menu: { buildFromTemplate: (items) => items },
      screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
      nativeImage: { createEmpty: () => ({}) },
    },
    './store': {
      getConfig: () => ({ ...config }),
      setConfig: (patch) => Object.assign(config, patch),
      getUnlocked: () => [], setUnlocked() {}, getFocusSeconds: () => 0,
      setFocusSeconds: (value) => { savedFocus = value; resetDay = false },
      getLifetimeEarned: () => 0, setLifetimeEarned() {},
      getLifetimeLessonIncome: () => 0,
      recordLessonIncome: (day, amount) => {
        lessonLedger[day] = amount
        return Object.values(lessonLedger).reduce((sum, value) => sum + value, 0)
      },
      maybeResetForNewDay: () => { const reset = resetDay; resetDay = false; return reset },
    },
    './monitor': { FishMonitor: class { updateConfig() {} sample() { return monitorRead() } } },
    './earnings': loadTypeScript('electron/earnings.ts'),
    './calendar': { countLessonsToday: (keyword) => calendarRead(keyword) },
    './roast': { makeRoast: (...args) => roastRead(...args) },
    '../src/data/achievements': { resolveAchievements: () => ({ unlocked: [], newlyUnlocked: [] }) },
  }, {
    Date: Clock,
    process: { env: { VITE_DEV_SERVER_URL: devServerURL }, platform: process.platform },
    setInterval: (callback, ms) => { intervals.set(ms, callback); return ms },
    console: { error: (...args) => errors.push(args) },
  })
  await settle()
  return {
    windows, errors,
    invokeAs(name, event, ...args) { return handlers.get(`money:${name}`)(event, ...args) },
    invoke(name, ...args) {
      const sender = windows.at(-1).webContents
      return handlers.get(`money:${name}`)({ sender, senderFrame: sender.mainFrame }, ...args)
    },
    quitCalls: () => quitCalls,
    async tick(seconds = 1) { now += seconds * 1000; intervals.get(1000)(); await settle() },
    async refresh() { intervals.get(5 * 60 * 1000)(); await settle() },
    snapshot() { return this.invoke('getSnapshot') },
    monitor(state) { monitorState = { ...monitorState, ...state } },
    sample(callback) { monitorRead = callback },
    calendar(callback) { calendarRead = callback },
    roast(callback) { roastRead = callback },
    nextDay() { now += 24 * 60 * 60 * 1000; resetDay = true },
    advance(seconds) { now += seconds * 1000 },
    suspend() { powerMonitor.emit('suspend') },
    resume() { powerMonitor.emit('resume') },
    flushFocus() { app.emit('before-quit'); return savedFocus },
  }
}

test('closing a window does not break subsequent ticks or focus persistence', async () => {
  const main = await mainRuntime()
  main.windows[0].close()
  await main.tick()
  await main.tick()
  assert.equal(main.errors.length, 0)
  assert.equal(main.flushFocus(), 2)
})

test('getSnapshot preserves the last real monitor state', async () => {
  const main = await mainRuntime()
  main.monitor({ status: 'entertainment', activeApp: 'Test game' })
  await main.tick()
  assert.equal(main.snapshot().monitor.status, 'entertainment')
  assert.equal(main.snapshot().monitor.activeApp, 'Test game')
})

test('closing an old overlay cannot clear the replacement window', async () => {
  const main = await mainRuntime()
  await main.invoke('setOverlayMode', 'fullscreen')
  await main.tick()
  assert.equal(main.windows.length, 2)
  assert.equal(main.windows[0].destroyed, true)
  assert.equal(main.windows[1].messages.filter(([channel]) => channel === 'money:snapshot').length, 2)
  assert.equal(main.errors.length, 0)
})

test('midnight clears yesterday’s lessons even when the new calendar read fails', async () => {
  const main = await mainRuntime()
  assert.equal(main.snapshot().earnings.lessonsToday, 2)
  main.calendar(async () => ({ lessons: 0, available: false }))
  main.nextDay()
  await main.tick()
  assert.equal(main.snapshot().earnings.lessonsToday, 0)
})

test('a slower old calendar query cannot overwrite newer settings', async () => {
  const main = await mainRuntime()
  const old = deferred()
  const latest = deferred()
  main.calendar((keyword) => keyword === 'old' ? old.promise : latest.promise)
  main.invoke('setConfig', { lessonKeyword: 'old' })
  main.invoke('setConfig', { lessonKeyword: 'new' })
  latest.resolve({ lessons: 3, available: true })
  await settle()
  old.resolve({ lessons: 9, available: true })
  await settle()
  assert.equal(main.snapshot().earnings.lessonsToday, 3)
})

test('calendar errors retain a successful count within the same day and keyword', async () => {
  const main = await mainRuntime()
  main.calendar(async () => ({ lessons: 0, available: false }))
  await main.refresh()
  assert.equal(main.snapshot().earnings.lessonsToday, 2)
})

test('yesterday’s in-flight calendar response is discarded after midnight', async () => {
  const main = await mainRuntime()
  const old = deferred()
  main.calendar(() => old.promise)
  await main.refresh()
  main.nextDay()
  main.calendar(async () => ({ lessons: 1, available: true }))
  await main.tick()
  old.resolve({ lessons: 9, available: true })
  await settle()
  assert.equal(main.snapshot().earnings.lessonsToday, 1)
})

test('system sleep is excluded from focused time after resume', async () => {
  const main = await mainRuntime()
  await main.tick()
  main.suspend()
  main.advance(3600)
  main.resume()
  await main.tick()
  assert.equal(main.flushFocus(), 2)
})

test('a tick delivered during system suspension cannot earn focus time', async () => {
  const main = await mainRuntime()
  main.suspend()
  await main.tick(60)
  assert.equal(main.flushFocus(), 0)
})

test('an in-flight pre-sleep sample is discarded after resume', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  main.sample(() => pending.promise)
  await main.tick()
  main.suspend()
  main.advance(3600)
  main.resume()
  pending.resolve({ status: 'working', idleSec: 0, activeApp: 'Test editor', switchCount: 0, permissionMissing: false })
  await settle()
  assert.equal(main.flushFocus(), 0)
  main.sample(async () => ({ status: 'working', idleSec: 0, activeApp: 'Test editor', switchCount: 0, permissionMissing: false }))
  await main.tick()
  assert.equal(main.flushFocus(), 1)
})

test('a slow roast cannot block focus sampling or attribute entertainment time as work', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  main.roast(() => pending.promise)
  main.monitor({ status: 'entertainment' })
  await main.tick()
  await main.tick(8)
  main.monitor({ status: 'working' })
  await main.tick()
  assert.equal(main.flushFocus(), 1)
  pending.resolve('Stale roast')
  await settle()
  assert.equal(main.windows[0].messages.filter(([channel]) => channel === 'money:fish').length, 0)
})

test('native sample started before pause and resume cannot bill the paused interval', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  main.sample(() => pending.promise)
  await main.tick()
  await main.invoke('setWorkMode', false)
  main.advance(60)
  await main.invoke('setWorkMode', true)
  main.advance(1)
  pending.resolve({ status: 'working', idleSec: 0, activeApp: 'Editor', switchCount: 0 })
  await settle()
  assert.equal(main.flushFocus(), 0)
})

test('pending sample with an old salary cannot bill time after settings changed', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  main.sample(() => pending.promise)
  await main.tick()
  await main.invoke('setConfig', { monthlySalary: 0 })
  main.advance(5)
  pending.resolve({ status: 'working', idleSec: 0, activeApp: 'Editor', switchCount: 0 })
  await settle()
  assert.equal(main.flushFocus(), 0)
  assert.equal(main.snapshot().earnings.lifetimeTotal, 40)
})

test('pausing discards a pending roast and paused ticks never request another', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  let calls = 0
  main.roast(() => { calls++; return pending.promise })
  main.monitor({ status: 'idle' })
  await main.tick()
  await main.invoke('setWorkMode', false)
  pending.resolve('Stale roast')
  await settle()
  await main.tick(30)
  assert.equal(calls, 1)
  assert.equal(main.windows[0].messages.filter(([channel]) => channel === 'money:fish').length, 0)
})

test('slow roasts stay single-flight when fishing status changes', async () => {
  const main = await mainRuntime()
  const pending = deferred()
  let calls = 0
  main.roast(() => { calls++; return pending.promise })
  main.monitor({ status: 'idle' })
  await main.tick()
  main.monitor({ status: 'entertainment' })
  await main.tick()
  assert.equal(main.snapshot().monitor.status, 'entertainment')
  assert.equal(calls, 1)
  pending.resolve('Old idle roast')
  await settle()
  assert.equal(main.windows[0].messages.filter(([channel]) => channel === 'money:fish').length, 0)
})

test('main retains previous lesson income across midnight and cannot duplicate a refresh', async () => {
  const main = await mainRuntime()
  await main.invoke('setWorkMode', false)
  assert.equal(main.snapshot().earnings.lifetimeTotal, 40)
  await main.refresh()
  assert.equal(main.snapshot().earnings.lifetimeTotal, 40)
  main.nextDay()
  main.calendar(async () => ({ lessons: 3, available: true }))
  await main.tick()
  assert.equal(main.snapshot().earnings.lessonIncomeToday, 60)
  assert.equal(main.snapshot().earnings.lifetimeTotal, 100)
  main.calendar(async () => ({ lessons: 0, available: false }))
  await main.refresh()
  assert.equal(main.snapshot().earnings.lifetimeTotal, 100)
})

test('quitting after midnight before the next tick cannot persist yesterday’s focused time as today', async () => {
  const main = await mainRuntime()
  await main.tick(60)
  main.nextDay()
  assert.equal(main.flushFocus(), 0)
})

test('a midnight snapshot clears yesterday’s focus before the next timer fires', async () => {
  const main = await mainRuntime()
  await main.tick(60)
  main.nextDay()
  assert.equal(main.snapshot().earnings.focusMinutes, 0)
})

test('suspending after midnight cannot restore yesterday’s focus on wake', async () => {
  const main = await mainRuntime()
  await main.tick(60)
  main.nextDay()
  main.suspend()
  main.advance(3600)
  main.resume()
  await main.tick()
  assert.equal(main.flushFocus(), 1)
})


test('renderer windows deny navigation, popups and browser permissions', async () => {
  const main = await mainRuntime()
  const win = main.windows[0]
  assert.equal(win.options.webPreferences.sandbox, true)
  assert.equal(win.options.webPreferences.nodeIntegration, false)
  assert.equal(win.options.webPreferences.contextIsolation, true)
  for (const event of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    let denied = false
    win.webContents.emit(event, { preventDefault() { denied = true } }, 'https://example.com')
    assert.equal(denied, true, event)
  }
  assert.equal(win.openHandler({ url: 'https://example.com' }).action, 'deny')
  assert.equal(win.checkPermission(), false)
  let granted
  win.requestPermission(win.webContents, 'media', (allowed) => { granted = allowed })
  assert.equal(granted, false)
})

test('every IPC channel rejects foreign windows, subframes and unexpected documents', async () => {
  const main = await mainRuntime()
  const sender = main.windows[0].webContents
  const trusted = { sender, senderFrame: sender.mainFrame }
  const calls = [
    ['getSnapshot'], ['getConfig'], ['setConfig', { monthlySalary: 1 }],
    ['setWorkMode', false], ['setOverlayMode', 'fullscreen'],
  ]
  const assertDenied = (event) => {
    for (const [channel, ...args] of calls) {
      assert.throws(() => main.invokeAs(channel, event, ...args), /Untrusted IPC sender/, channel)
    }
    main.invokeAs('quit', event)
    assert.equal(main.quitCalls(), 0)
  }
  assertDenied({ ...trusted, sender: {} })
  assertDenied({ ...trusted, senderFrame: { url: sender.mainFrame.url } })
  assertDenied({ ...trusted, senderFrame: null })
  const url = sender.mainFrame.url
  for (const untrusted of ['https://example.com', `${url}?other`, `${url}/other`, 'invalid']) {
    sender.mainFrame.url = untrusted
    assertDenied(trusted)
  }
  sender.mainFrame.url = `${url}#settings`
  assert.equal(main.invokeAs('getConfig', trusted).monthlySalary, 3000)
  main.invokeAs('quit', trusted)
  assert.equal(main.quitCalls(), 1)
})

test('a replaced or closed window loses IPC access', async () => {
  const main = await mainRuntime()
  const old = main.windows[0].webContents
  await main.invoke('setOverlayMode', 'fullscreen')
  assert.throws(() => main.invokeAs('getSnapshot', { sender: old, senderFrame: old.mainFrame }), /Untrusted IPC sender/)
  const current = main.windows[1].webContents
  main.windows[1].close()
  assert.throws(() => main.invokeAs('getConfig', { sender: current, senderFrame: current.mainFrame }), /Untrusted IPC sender/)
})


test('development IPC accepts only its exact document and packaged apps ignore the dev URL', async () => {
  const devServerURL = 'http://127.0.0.1:5173/'
  const dev = await mainRuntime({ devServerURL })
  const sender = dev.windows[0].webContents
  assert.equal(sender.mainFrame.url, devServerURL)
  assert.equal(dev.snapshot().config.monthlySalary, 3000)
  sender.mainFrame.url = `${devServerURL}other`
  assert.throws(() => dev.snapshot(), /Untrusted IPC sender/)
  const packaged = await mainRuntime({ devServerURL, packaged: true })
  assert.ok(packaged.windows[0].webContents.mainFrame.url.startsWith('file:'))
  assert.equal(packaged.snapshot().config.monthlySalary, 3000)
})
