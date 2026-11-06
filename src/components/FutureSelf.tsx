import { useEffect, useRef, useState } from 'react'
import { getFutureMessage, type FutureMessage } from '../data/future-self'
import type { FishEvent } from '../hooks/useAppState'

// 「未来的自己」随机发来消息催你干活。
// 触发: 摸鱼被抓时有概率弹一条;另外每隔 4~7 分钟随机弹一条。
export function FutureSelf({ fish }: { fish: FishEvent | null }) {
  const [msg, setMsg] = useState<FutureMessage | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function popup() {
    setMsg(getFutureMessage())
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setMsg(null), 9000)
  }

  // 卸载时清掉自动关闭 timer,避免对已卸载组件 setState(修审查 L2)
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  // 摸鱼时,有 50% 概率叫未来的自己出来补刀(避免和吐槽同时太吵)
  useEffect(() => {
    if (fish && Math.random() < 0.5) {
      const t = setTimeout(popup, 1500)
      return () => clearTimeout(t)
    }
  }, [fish])

  // 随机定时催
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = (4 + Math.random() * 3) * 60 * 1000
      timer = setTimeout(() => {
        popup()
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  if (!msg) return null
  return (
    <div className="toast toast-future no-drag" onClick={() => setMsg(null)}>
      <div className="from">📨 {msg.from} 给你发来一条消息</div>
      <div className="body">{msg.text}</div>
    </div>
  )
}
