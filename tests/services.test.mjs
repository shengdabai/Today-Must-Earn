import assert from 'node:assert/strict'
import test from 'node:test'
import { deferred, loadTypeScript, settle } from './helpers/runtime.mjs'

async function monitorRuntime() {
  let read = async () => ({ owner: { name: 'Editor' } })
  let idle = 0
  let now = 0
  let calls = 0
  const timers = new Map()
  let timerId = 0
  const { FishMonitor } = loadTypeScript('electron/monitor.ts', {
    electron: { powerMonitor: { getSystemIdleTime: () => idle } },
    'active-win': { __esModule: true, default: () => { calls++; return read() } },
  }, {
    Date: class extends Date { static now() { return now } },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId },
    clearTimeout: (id) => timers.delete(id),
  })
  const monitor = new FishMonitor({ idleThresholdSec: 10, entertainmentApps: [] })
  await settle()
  return {
    sample: () => monitor.sample(),
    read(callback) { read = callback },
    idle(value) { idle = value },
    advance(ms) { now += ms },
    timeout() { [...timers.values()].forEach((callback) => callback()) },
    get calls() { return calls },
    get timers() { return timers.size },
  }
}

test('monitor timeout preserves a previously observed permission failure', async () => {
  const monitor = await monitorRuntime()
  monitor.read(async () => { throw new Error('Permission denied') })
  assert.equal((await monitor.sample()).permissionMissing, true)
  monitor.read(() => deferred().promise)
  const pending = monitor.sample()
  monitor.timeout()
  assert.equal((await pending).permissionMissing, true)
})

test('monitor bounds outstanding native probes and clears timeout handles', async () => {
  const monitor = await monitorRuntime()
  const probe = deferred()
  monitor.read(() => probe.promise)
  for (let i = 0; i < 3; i++) {
    const sample = monitor.sample()
    monitor.timeout()
    await sample
  }
  assert.equal(monitor.calls, 1)
  probe.resolve({ owner: { name: 'Editor' } })
  await settle()
  monitor.read(async () => ({ owner: { name: 'Editor' } }))
  assert.equal((await monitor.sample()).permissionMissing, false)
  assert.equal(monitor.timers, 0)
})

test('idle samples expire old switching history', async () => {
  const monitor = await monitorRuntime()
  for (let i = 0; i < 12; i++) {
    monitor.read(async () => ({ owner: { name: `Editor ${i}` } }))
    await monitor.sample()
  }
  monitor.idle(90)
  monitor.advance(61_000)
  assert.equal((await monitor.sample()).switchCount, 0)
})

test('missing foreground observations do not report stale switching as a new detection', async () => {
  const monitor = await monitorRuntime()
  for (let i = 0; i < 12; i++) {
    monitor.read(async () => ({ owner: { name: `Editor ${i}` } }))
    await monitor.sample()
  }
  monitor.read(async () => { throw new Error('Permission denied') })
  assert.equal((await monitor.sample()).status, 'working')
})

function calendarRuntime(replies) {
  const calls = []
  const { countLessonsToday } = loadTypeScript('electron/calendar.ts', {
    'node:child_process': { execFile(command, args, options, callback) {
      calls.push({ command, args, options })
      const result = replies.shift()
      assert.ok(result, 'unexpected additional calendar probe')
      callback(result.error ?? null, result.stdout ?? '')
    } },
  })
  return { countLessonsToday, calls }
}

test('calendar event query failure is unavailable even if a separate calendar probe could succeed', async () => {
  const calendar = calendarRuntime([{ error: new Error('Query timed out') }, { stdout: '1' }])
  assert.equal((await calendar.countLessonsToday('中文课')).available, false)
  assert.equal(calendar.calls.length, 1)
})

test('a successful empty calendar remains available without a second probe', async () => {
  const calendar = calendarRuntime([{ stdout: '' }, { stdout: '1' }])
  const result = await calendar.countLessonsToday('中文课')
  assert.equal(result.available, true)
  assert.equal(result.lessons, 0)
  assert.equal(calendar.calls.length, 1)
})

test('calendar scripts propagate per-calendar failures and keep keywords outside executable code', async () => {
  const calendar = calendarRuntime([{ stdout: '中文课 1\nOther\n中文课 2\n' }])
  assert.equal((await calendar.countLessonsToday('中文课')).lessons, 2)
  assert.doesNotMatch(calendar.calls[0].args[1], /\btry\b/)
  const keyword = '" & do shell script "anything'
  const second = calendarRuntime([{ stdout: '' }, { stdout: '1' }])
  await second.countLessonsToday(keyword)
  assert.ok(second.calls[0].args.every((arg) => !arg.includes(keyword)))
})

test('config sanitization rejects non-object IPC and disk values without throwing', () => {
  const { sanitizeConfig, DEFAULT_CONFIG } = loadTypeScript('electron/store.ts', {
    'electron-store': class { constructor() {} },
  })
  for (const value of [12, true, 'invalid', null, undefined]) {
    assert.deepEqual(sanitizeConfig(value, DEFAULT_CONFIG), DEFAULT_CONFIG)
  }
  const invalid = { monthlySalary: { valueOf: 1, toString: 1 }, dreams: [
    { name: { valueOf: 1, toString: 1 }, emoji: { toString: 0 }, price: {} },
  ] }
  assert.doesNotThrow(() => sanitizeConfig(invalid, DEFAULT_CONFIG))
})

function incomeStore(data = {}) {
  return loadTypeScript('electron/store.ts', {
    'electron-store': class {
      get(key) { return data[key] }
      set(key, value) { data[key] = value }
    },
  })
}

test('daily lesson income survives refresh, midnight, correction and restart without double counting', () => {
  const disk = {}
  const store = incomeStore(disk)
  assert.equal(store.getLifetimeLessonIncome(), 0)
  assert.equal(store.recordLessonIncome('2026-10-29', 40), 40)
  assert.equal(store.recordLessonIncome('2026-10-29', 40), 40)
  assert.equal(store.recordLessonIncome('2026-10-30', 60), 100)
  assert.equal(incomeStore(disk).getLifetimeLessonIncome(), 100)
  assert.equal(store.recordLessonIncome('2026-10-29', 20), 80)
  assert.equal(store.recordLessonIncome('2026-10-30', 0), 20)
})

test('invalid stored lesson amounts and invalid updates cannot corrupt cumulative income', () => {
  const store = incomeStore({ lessonIncomeByDay: {
    '2026-10-29': 40, '2026-10-30': -1, '2026-10-31': Infinity, bad: 10,
  } })
  assert.equal(store.getLifetimeLessonIncome(), 40)
  for (const amount of [-1, NaN, Infinity, '20']) {
    assert.equal(store.recordLessonIncome('2026-10-29', amount), 40)
  }
  assert.equal(store.recordLessonIncome('invalid', 100), 40)
})

test('earnings combines recorded lesson income with salary without adding today twice', () => {
  const { computeEarnings } = loadTypeScript('electron/earnings.ts')
  const config = { monthlySalary: 3000, workdaysPerMonth: 22, workHoursPerDay: 8, lessonIncome: 20 }
  const earnings = computeEarnings(config, 0, 2, 100, 60)
  assert.equal(earnings.lifetimeTotal, 160)
  assert.equal(earnings.lessonIncomeToday, 40)
})

function roastRuntime(endpoint, response = 'Remote fixture') {
  const calls = []
  const { makeRoast } = loadTypeScript('electron/roast.ts', {
    '../src/data/roasts': { generateRoast: () => 'Local fixture' },
  }, {
    process: { env: { MONEY_AI_ENDPOINT: endpoint, MONEY_AI_KEY: 'synthetic-test-key' } },
    URL,
    AbortSignal: { timeout: () => undefined },
    fetch: async (url, options) => {
      calls.push({ url, options })
      return { ok: true, json: async () => ({ choices: [{ message: { content: response } }] }) }
    },
  })
  return { makeRoast, calls }
}

test('AI credentials stay off insecure remote endpoints and embedded-credential URLs', async () => {
  for (const endpoint of ['http://provider.invalid/api', 'file:///fixture', 'invalid', 'https://user:fixture@provider.invalid']) {
    const roast = roastRuntime(endpoint)
    assert.equal(await roast.makeRoast('idle', {}), 'Local fixture')
    assert.equal(roast.calls.length, 0)
  }
})

test('AI requests reject redirects and keep local loopback development available', async () => {
  for (const endpoint of ['https://provider.invalid/api', 'http://127.0.0.1:1234/api']) {
    const roast = roastRuntime(endpoint)
    assert.equal(await roast.makeRoast('idle', {}), 'Remote fixture')
    assert.equal(roast.calls.length, 1)
    assert.equal(roast.calls[0].options.redirect, 'error')
  }
})

test('working state cannot trigger a remote roast even when configured', async () => {
  const roast = roastRuntime('https://provider.invalid/api')
  assert.equal(await roast.makeRoast('working', {}), 'Local fixture')
  assert.equal(roast.calls.length, 0)
})
