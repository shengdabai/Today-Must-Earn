import type { AppSnapshot } from '../lib/types'
import { pct, shortMoney } from '../lib/format'

// 财富进度条:用「生涯累计赚到的钱」对照梦想目标(跨天累积,不每天归零)。
export function WealthProgress({ snapshot }: { snapshot: AppSnapshot }) {
  const { config, earnings } = snapshot
  const earned = earnings.lifetimeTotal

  return (
    <div className="card">
      <h3>💰 财富进度条 · 梦想还有多远</h3>
      {config.dreams.map((d) => {
        const p = pct(earned, d.price)
        return (
          <div className="dream" key={d.name}>
            <div className="dream-top">
              <span className="dream-name">
                {d.emoji} {d.name}
              </span>
              <span className="dream-pct money">{p.toFixed(p < 1 ? 3 : 1)}%</span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.max(p, 0.5)}%` }} />
            </div>
            <div className="muted text-xs mt-1">
              累计已赚 {shortMoney(earned, config.currency)} / 目标{' '}
              {shortMoney(d.price, config.currency)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
