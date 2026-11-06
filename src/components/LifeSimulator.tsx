import type { AppSnapshot } from '../lib/types'

// 人生模拟器:基于今日专注分钟,推演「继续摸鱼」vs「继续努力」两种结局。
// 越努力,努力侧结局越香;摸鱼侧永远阴间,黑色幽默。
export function LifeSimulator({ snapshot }: { snapshot: AppSnapshot }) {
  const mins = snapshot.earnings.focusMinutes
  const tier = mins < 30 ? 0 : mins < 120 ? 1 : mins < 240 ? 2 : 3

  const fishEndings = [
    '一年后:工位还是这个工位,余额还是这个余额,只是你又老了一岁。',
    '三年后:同龄人买了车,你买了「同款车模型」摆在桌上自我安慰。',
    '五年后:你成了公司「资深摸鱼大师」,荣誉满满,存款空空。',
    '十年后:回首往事,你最熟练的技能是 Alt+Tab,最大的资产是回忆。',
  ]
  const grindEndings = [
    '一年后:你升职了,虽然只是组长,但工资条终于不再让你失眠。',
    '三年后:你攒下了第一桶金,开始有底气对烂活说「不」。',
    '五年后:你有了被动收入,周一不再是惊悚片,而是普通的一天。',
    '十年后:你实现了梦想清单的一大半,而起点,就是某个你没摸鱼的下午。',
  ]

  return (
    <div className="card">
      <h3>🔮 人生模拟器 · 两条岔路</h3>
      <div className="sim">
        <div className="col fish">
          <h4 className="danger">🐟 继续摸鱼线</h4>
          <p>{fishEndings[tier]}</p>
        </div>
        <div className="col grind">
          <h4 className="good">🔥 继续努力线</h4>
          <p>{grindEndings[tier]}</p>
        </div>
      </div>
      <div className="muted text-xs mt-2">
        今日已专注 <span className="mono good">{Math.floor(mins)}</span> 分钟 ——
        努力线的结局随你的专注时长实时升级。
      </div>
    </div>
  )
}
