import assert from 'node:assert/strict'
import test from 'node:test'
import { deferred, hookRuntime, loadTypeScript, settle } from './helpers/runtime.mjs'

function counter(initial = 100) {
  const hooks = hookRuntime()
  let now = 0
  let frame
  let snapshot = {
    config: { currency: '€', monthlySalary: 3000 },
    monitor: { status: 'working' },
    workMode: true,
    earnings: {
      totalToday: initial, perSecond: 1, perMinute: 60,
      lessonsToday: 0, lessonIncomeToday: 0, todayTarget: 200,
    },
  }
  const { MoneyCounter } = loadTypeScript('src/components/MoneyCounter.tsx', {
    react: hooks.react,
    '../lib/format': loadTypeScript('src/lib/format.ts'),
  }, {
    Date: { now: () => now },
    requestAnimationFrame: (callback) => { frame = callback; return 1 },
    cancelAnimationFrame: () => { frame = undefined },
  })
  const render = () => hooks.render(() => MoneyCounter({ snapshot, size: 'floating' }))
  const value = (tree) => tree.props.children[1].props.children
  render()
  return {
    frame(ms) { now = ms; frame(); return value(hooks.flush()) },
    update(total, workMode = true) {
      snapshot = { ...snapshot, workMode, earnings: { ...snapshot.earnings, totalToday: total } }
      render()
      frame()
      return value(hooks.flush())
    },
    close: () => hooks.unmount(),
  }
}

test('daily reset replaces yesterday’s displayed amount', () => {
  const c = counter()
  try {
    assert.equal(c.frame(900), '€100.90')
    assert.equal(c.update(0, false), '€0.00')
  } finally { c.close() }
})

test('a corrected salary/calendar snapshot can lower the displayed amount', () => {
  const c = counter()
  try {
    c.frame(900)
    assert.equal(c.update(50), '€50.00')
  } finally { c.close() }
})

test('paused money stays fixed between snapshots', () => {
  const c = counter()
  try {
    c.update(100, false)
    assert.equal(c.frame(10_000), '€100.00')
  } finally { c.close() }
})

test('achievement dismiss callback stays stable during snapshot updates', async () => {
  const hooks = hookRuntime()
  const initial = deferred()
  let onSnapshot
  let onAchievement
  let removed = 0
  const { useAppState } = loadTypeScript('src/hooks/useAppState.ts', { react: hooks.react }, {
    window: { money: {
      getSnapshot: () => initial.promise,
      onSnapshot: (callback) => { onSnapshot = callback; return () => removed++ },
      onFishCaught: () => () => removed++,
      onAchievement: (callback) => { onAchievement = callback; return () => removed++ },
    } },
  })
  let state = hooks.render(useAppState)
  initial.resolve({ sequence: 0 })
  await settle()
  state = hooks.flush()
  onAchievement('first-focus')
  state = hooks.flush()
  const dismiss = state.clearAchievement
  try {
    for (let sequence = 1; sequence <= 8; sequence++) {
      onSnapshot({ sequence })
      state = hooks.flush()
      assert.equal(state.clearAchievement, dismiss)
      assert.equal(state.achievementId, 'first-focus')
    }
    dismiss()
    assert.equal(hooks.flush().achievementId, null)
  } finally {
    hooks.unmount()
    assert.equal(removed, 3)
  }
})

test('a slow initial snapshot cannot overwrite a newer pushed snapshot', async () => {
  const hooks = hookRuntime()
  const initial = deferred()
  let onSnapshot
  const { useAppState } = loadTypeScript('src/hooks/useAppState.ts', { react: hooks.react }, {
    window: { money: {
      getSnapshot: () => initial.promise,
      onSnapshot: (callback) => { onSnapshot = callback; return () => {} },
      onFishCaught: () => () => {},
      onAchievement: () => () => {},
    } },
  })
  hooks.render(useAppState)
  try {
    onSnapshot({ sequence: 2 })
    hooks.flush()
    initial.resolve({ sequence: 1 })
    await settle()
    assert.equal(hooks.flush().snapshot.sequence, 2)
  } finally { hooks.unmount() }
})
