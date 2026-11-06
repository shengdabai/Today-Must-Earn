import { useEffect, useRef, useState } from 'react'
import type { AppSnapshot } from '../lib/types'
import { money } from '../lib/format'

// 今日赚钱进度大字报。在两次快照之间按 perSecond 平滑跳动,制造「实时进账」感。
export function MoneyCounter({ snapshot, size }: { snapshot: AppSnapshot; size: 'floating' | 'fullscreen' }) {
  const { earnings, config, monitor } = snapshot
  const cur = config.currency
  const [display, setDisplay] = useState(earnings.totalToday)
  const baseRef = useRef({
    total: earnings.totalToday,
    at: Date.now(),
    perSec: earnings.perSecond,
    working: monitor.status === 'working' && snapshot.workMode,
  })
  const displayRef = useRef(display)
  displayRef.current = display

  useEffect(() => {
    // 快照是实际金额:跨天归零、改月薪或移除排课都可能让金额下降。
    // 插值只用于两次快照之间,不能把旧显示值带进下一次计算。
    baseRef.current = {
      total: earnings.totalToday,
      at: Date.now(),
      perSec: earnings.perSecond,
      working: monitor.status === 'working' && snapshot.workMode,
    }
  }, [earnings.totalToday, earnings.perSecond, monitor.status, snapshot.workMode])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const b = baseRef.current
      if (b.working) {
        const dt = (Date.now() - b.at) / 1000
        const next = b.total + b.perSec * dt
        // 仅在值真正变化时 setState,非工作态不空转(修审查 M7)
        if (Math.abs(next - displayRef.current) > 1e-4) setDisplay(next)
      } else if (Math.abs(b.total - displayRef.current) > 1e-4) {
        setDisplay(b.total)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const lessonLine =
    earnings.lessonsToday > 0
      ? `今日 ${earnings.lessonsToday} 节课 = ${money(earnings.lessonIncomeToday, cur)}`
      : '今日 0 节课,纯靠底薪在续命'
  const rateLine =
    config.monthlySalary > 0
      ? `每分钟 ${money(earnings.perMinute, cur)} · ${lessonLine}`
      : '还没设月薪,点 ⚙️ 让我开始算账'
  const gap = Math.max(0, earnings.todayTarget - display)

  if (size === 'floating') {
    return (
      <div>
        <div className="label">今日已赚 · TODAY</div>
        <div className="amount huge mono money">{money(display, cur)}</div>
        <div className="rate muted mono">{rateLine}</div>
        <div className="rate danger mono">离今日目标还差 {money(gap, cur)}</div>
      </div>
    )
  }

  return (
    <div className="fs-main">
      <div className="fs-title">今日已赚 · MONEY MADE TODAY</div>
      <div className="fs-amount huge mono money">{money(display, cur)}</div>
      <div className="fs-sub muted mono">{rateLine}</div>
      <div className="fs-sub muted">
        目标 {money(earnings.todayTarget, cur)} · 还差{' '}
        <span className="danger mono">{money(gap, cur)}</span>
      </div>
    </div>
  )
}
