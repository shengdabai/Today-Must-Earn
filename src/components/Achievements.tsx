import { ACHIEVEMENTS } from '../data/achievements'
import type { AppSnapshot } from '../lib/types'

export function Achievements({ snapshot }: { snapshot: AppSnapshot }) {
  const unlocked = new Set(snapshot.unlockedAchievements)
  return (
    <div className="card">
      <h3>🏆 成就 · 称号墙</h3>
      <div className="ach">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id)
          return (
            <span
              className={`badge ${got ? '' : 'locked'}`}
              key={a.id}
              title={got ? `${a.desc} · ${a.reward}` : `未解锁: ${a.desc}`}
            >
              {got ? a.icon : '🔒'} {got ? a.title : '???'}
            </span>
          )
        })}
      </div>
    </div>
  )
}
