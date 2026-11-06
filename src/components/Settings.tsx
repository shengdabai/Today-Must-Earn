import { useState } from 'react'
import type { Config } from '../lib/types'

// 设置: 月薪 / 课程关键词与单价 / 摸鱼阈值 / 梦想目标 / 显示模式 / 工作计时。
export function Settings({
  config,
  workMode,
  onSave,
  onClose,
}: {
  config: Config
  workMode: boolean
  onSave: (patch: Partial<Config>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Config>(config)

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function setDream(i: number, k: 'name' | 'emoji' | 'price', v: string) {
    const dreams = form.dreams.map((d, idx) =>
      idx === i ? { ...d, [k]: k === 'price' ? Number(v) || 0 : v } : d,
    )
    set('dreams', dreams)
  }

  return (
    <div className="settings no-drag">
      <h2 className="huge settings-title">
        ⚙️ 设置一下,别让我瞎算
      </h2>
      <p className="muted text-sm mb-5">
        把你卖多少钱告诉我,我才能精准地嘲讽你摸鱼。
      </p>

      {/* —— 显示与计时(应用内即可切,不必去托盘)—— */}
      <div className="row">
        <label>显示模式</label>
        <button
          className={`btn ${form.overlayMode === 'floating' ? '' : 'ghost'}`}
          onClick={() => { set('overlayMode', 'floating'); window.money.setOverlayMode('floating') }}
        >
          悬浮窗
        </button>
        <button
          className={`btn ${form.overlayMode === 'fullscreen' ? '' : 'ghost'}`}
          onClick={() => { set('overlayMode', 'fullscreen'); window.money.setOverlayMode('fullscreen') }}
        >
          全屏大字报
        </button>
      </div>
      <div className="row">
        <label>工作计时</label>
        <button
          className={`btn ${workMode ? '' : 'ghost'}`}
          onClick={() => window.money.setWorkMode(!workMode)}
        >
          {workMode ? '✅ 计时中(点击暂停)' : '⏸️ 已暂停(点击开工)'}
        </button>
      </div>

      <div className="row">
        <label>月薪 ({form.currency})</label>
        <input
          type="number" min={0} placeholder="例如 3000"
          value={form.monthlySalary}
          onChange={(e) => set('monthlySalary', Number(e.target.value) || 0)}
        />
      </div>
      <div className="row">
        <label>币种符号</label>
        <input value={form.currency} placeholder="€ / ¥ / $"
          onChange={(e) => set('currency', e.target.value)} />
      </div>
      <div className="row">
        <label>每月工作天数</label>
        <input
          type="number" min={1} max={31}
          value={form.workdaysPerMonth}
          onChange={(e) => set('workdaysPerMonth', Number(e.target.value) || 1)}
        />
      </div>
      <div className="row">
        <label>每天工作小时</label>
        <input
          type="number" min={1} max={24}
          value={form.workHoursPerDay}
          onChange={(e) => set('workHoursPerDay', Number(e.target.value) || 1)}
        />
      </div>
      <div className="row">
        <label>日历课程关键词</label>
        <input
          value={form.lessonKeyword} placeholder="中文课"
          onChange={(e) => set('lessonKeyword', e.target.value)}
        />
      </div>
      <div className="row">
        <label>一节课收入</label>
        <input
          type="number" min={0} placeholder="20"
          value={form.lessonIncome}
          onChange={(e) => set('lessonIncome', Number(e.target.value) || 0)}
        />
      </div>
      <div className="row">
        <label>摸鱼判定(秒无操作)</label>
        <input
          type="number" min={10}
          value={form.idleThresholdSec}
          onChange={(e) => set('idleThresholdSec', Number(e.target.value) || 60)}
        />
      </div>

      <h3 className="settings-sub">
        梦想目标
      </h3>
      {form.dreams.map((d, i) => (
        <div className="row" key={i}>
          <input
            className="input-emoji" placeholder="🎯"
            value={d.emoji}
            onChange={(e) => setDream(i, 'emoji', e.target.value)}
          />
          <input value={d.name} placeholder="梦想名"
            onChange={(e) => setDream(i, 'name', e.target.value)} />
          <input
            type="number" min={0} placeholder="目标金额"
            value={d.price}
            onChange={(e) => setDream(i, 'price', e.target.value)}
          />
        </div>
      ))}

      <div className="settings-actions">
        <button
          className="btn"
          onClick={() => {
            onSave(form)
            onClose()
          }}
        >
          保存,然后我去赚钱
        </button>
        <button className="btn ghost" onClick={onClose}>
          算了,继续穷
        </button>
      </div>
    </div>
  )
}
