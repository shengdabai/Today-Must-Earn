import { useEffect, useState } from 'react'
import { useAppState } from './hooks/useAppState'
import { MoneyCounter } from './components/MoneyCounter'
import { RoastBanner } from './components/RoastBanner'
import { FutureSelf } from './components/FutureSelf'
import { WealthProgress } from './components/WealthProgress'
import { LifeSimulator } from './components/LifeSimulator'
import { Achievements } from './components/Achievements'
import { MemeWall } from './components/MemeWall'
import { Settings } from './components/Settings'
import { ACHIEVEMENTS } from './data/achievements'
import type { Config, FishStatus } from './lib/types'

const STATUS_LABEL: Record<FishStatus, string> = {
  working: '🔥 正在赚钱',
  idle: '💤 发呆/离开',
  entertainment: '🐟 在娱乐网站摸鱼',
  switching: '🌀 假装很忙(疯狂切屏)',
}

export default function App() {
  const { snapshot, fish, achievementId, clearAchievement } = useAppState()
  const [showSettings, setShowSettings] = useState(false)

  // 成就解锁 toast
  useEffect(() => {
    if (achievementId) {
      const t = setTimeout(clearAchievement, 6000)
      return () => clearTimeout(t)
    }
  }, [achievementId, clearAchievement])

  if (!snapshot) {
    return (
      <div className="floating drag">
        <div className="label">启动中…</div>
        <div className="amount huge mono money">€0.00</div>
        <div className="muted text-xs">正在算你今天该赚多少</div>
      </div>
    )
  }

  const isFishing = snapshot.monitor.status !== 'working'
  const floating = snapshot.config.overlayMode === 'floating'

  function save(patch: Partial<Config>) {
    window.money.setConfig(patch)
  }

  const ach = achievementId ? ACHIEVEMENTS.find((a) => a.id === achievementId) : null

  // 设置面板覆盖在最上层
  if (showSettings) {
    return (
      <Settings
        config={snapshot.config}
        workMode={snapshot.workMode}
        onSave={save}
        onClose={() => setShowSettings(false)}
      />
    )
  }

  // —— 成就 / 未来的自己 浮层(两种布局共用,分锚点防重叠)——
  const overlays = (
    <>
      <FutureSelf fish={fish} />
      {ach && (
        <div className="toast no-drag" onClick={clearAchievement}>
          <div className="from">🏆 成就解锁</div>
          <div className="body">
            <b>{ach.icon} {ach.title}</b> —— {ach.reward}
          </div>
        </div>
      )}
    </>
  )

  // —— 悬浮窗布局 ——
  if (floating) {
    return (
      <div className={`floating drag ${isFishing ? 'fishing' : ''}`}>
        {overlays}
        <div className="no-drag row-between">
          <span className={`pill ${isFishing ? 'fishing' : 'working'}`}>
            {STATUS_LABEL[snapshot.monitor.status]}
          </span>
          <span
            className="muted no-drag icon-btn"
            onClick={() => setShowSettings(true)}
            title="设置"
          >
            ⚙️
          </span>
        </div>
        <MoneyCounter snapshot={snapshot} size="floating" />
        <div className="roast no-drag">
          <RoastBanner fish={fish} />
        </div>
        {snapshot.monitor.permissionMissing && (
          <div className="perm-hint danger no-drag">没给屏幕录制权限,你摸鱼我看不见,但你心里有数</div>
        )}
      </div>
    )
  }

  // —— 全屏大字报布局 ——
  return (
    <div className="fullscreen">
      {overlays}
      <div className="fs-header drag">
        <span className="fs-title">今天 · 也 · 得 · 赚 · 钱</span>
        <span className="statusbar no-drag">
          <span className={`pill ${isFishing ? 'fishing' : 'working'}`}>
            {STATUS_LABEL[snapshot.monitor.status]}
          </span>
          {snapshot.monitor.permissionMissing && (
            <span className="muted text-xs">
              没给屏幕录制权限,娱乐网站/切屏检测我看不见
            </span>
          )}
          <button className="btn ghost no-drag" onClick={() => setShowSettings(true)}>
            ⚙️ 设置
          </button>
        </span>
      </div>

      <MoneyCounter snapshot={snapshot} size="fullscreen" />

      <div className="fs-side">
        <WealthProgress snapshot={snapshot} />
        <Achievements snapshot={snapshot} />
        <MemeWall />
      </div>

      <div className="fs-footer">
        {/* 大字报横幅裸字,不套卡片框,保留砸脸冲击(修审查 P1-2) */}
        <div className="roast-stage">
          <RoastBanner fish={fish} />
        </div>
        <LifeSimulator snapshot={snapshot} />
      </div>
    </div>
  )
}
