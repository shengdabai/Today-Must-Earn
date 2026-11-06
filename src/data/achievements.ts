// 成就 / 称号 / 搞笑奖励
// 每完成一段专注工作时间自动解锁。focusMinutes = 累计当日专注分钟。

export interface Achievement {
  id: string
  title: string // 称号
  icon: string // emoji
  desc: string // 解锁说明
  reward: string // 搞笑奖励
  threshold: number // 累计专注分钟门槛
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', title: '人类高质量打工人', icon: '🩸', desc: '专注满 5 分钟', reward: '奖励你一次理直气壮的喝水', threshold: 5 },
  { id: 'quarter', title: '番茄刺客', icon: '🍅', desc: '专注满 25 分钟', reward: '允许你摸鱼 5 分钟(老板不知道)', threshold: 25 },
  { id: 'half-hour', title: '坐得住的成年人', icon: '🪑', desc: '专注满 30 分钟', reward: '颁发「屁股稳定性」勋章一枚', threshold: 30 },
  { id: 'one-hour', title: '一小时圣体', icon: '⏳', desc: '专注满 60 分钟', reward: '解锁隐藏台词: 我真的可以', threshold: 60 },
  { id: 'two-hour', title: '反摸鱼斗士', icon: '🥊', desc: '专注满 120 分钟', reward: '赏你一个不被裁的今天', threshold: 120 },
  { id: 'half-day', title: '当代愚公', icon: '⛰️', desc: '专注满 240 分钟', reward: '梦想进度条偷偷给你 +1%', threshold: 240 },
  { id: 'full-day', title: '卷王本王', icon: '👑', desc: '专注满 360 分钟', reward: '同事眼神里的羡慕(限量版)', threshold: 360 },
  { id: 'machine', title: '碳基永动机', icon: '🤖', desc: '专注满 480 分钟', reward: '建议你看看医生,以及看看存款', threshold: 480 },
]

// 返回当前累计专注时长下:全部已解锁列表 + 本次所有新解锁(可能一次跨多个门槛)
export function resolveAchievements(focusMinutes: number, alreadyUnlocked: string[]): {
  unlocked: Achievement[]
  newlyUnlocked: Achievement[]
} {
  const unlocked = ACHIEVEMENTS.filter((a) => focusMinutes >= a.threshold)
  const newlyUnlocked = unlocked.filter((a) => !alreadyUnlocked.includes(a.id))
  return { unlocked, newlyUnlocked }
}
