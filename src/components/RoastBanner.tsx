import { useEffect, useRef, useState } from 'react'
import { generateRoast } from '../data/roasts'
import type { FishEvent } from '../hooks/useAppState'

// AI吐槽横幅。优先显示主进程推来的「摸鱼实锤」吐槽,否则轮播随机毒鸡汤。
export function RoastBanner({ fish }: { fish: FishEvent | null }) {
  const [text, setText] = useState(() => generateRoast('random'))
  const [fishing, setFishing] = useState(false)
  const fishingRef = useRef(false)
  fishingRef.current = fishing

  // 摸鱼事件:立刻顶上去,标红
  useEffect(() => {
    if (fish) {
      setText(fish.roast)
      setFishing(true)
      const t = setTimeout(() => setFishing(false), 8000)
      return () => clearTimeout(t)
    }
  }, [fish])

  // 没摸鱼时,每 12s 换一条随机毒鸡汤(稳定节拍,不随 fishing 切换重建)
  useEffect(() => {
    const id = setInterval(() => {
      if (!fishingRef.current) setText(generateRoast('random'))
    }, 12000)
    return () => clearInterval(id)
  }, [])

  return <div className={`roast-banner ${fishing ? 'fishing' : ''}`}>{text}</div>
}
