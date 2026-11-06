import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSnapshot, FishStatus } from '../lib/types'

export interface FishEvent {
  status: FishStatus
  roast: string
  at: number
}

// 订阅主进程快照 + 摸鱼事件 + 成就事件。
export function useAppState() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [fish, setFish] = useState<FishEvent | null>(null)
  const [achievementId, setAchievementId] = useState<string | null>(null)
  const idCounter = useRef(0)
  // App 的自动关闭计时器依赖此函数;快照刷新时不能改变函数身份。
  const clearAchievement = useCallback(() => setAchievementId(null), [])

  useEffect(() => {
    let mounted = true
    let receivedSnapshot = false

    const offSnap = window.money.onSnapshot((s) => {
      receivedSnapshot = true
      setSnapshot(s)
    })
    const offFish = window.money.onFishCaught((p) =>
      setFish({ ...p, at: ++idCounter.current }),
    )
    const offAch = window.money.onAchievement((id) => setAchievementId(id))

    // 先订阅再读取;较慢的初始响应不能覆盖更新的推送。
    window.money.getSnapshot()
      .then((s) => { if (mounted && !receivedSnapshot) setSnapshot(s) })
      .catch((err) => console.error('[snapshot]', err))

    return () => {
      mounted = false
      offSnap()
      offFish()
      offAch()
    }
  }, [])

  return { snapshot, fish, achievementId, clearAchievement }
}
