import { useEffect, useState } from 'react'
import { getMeme, type Meme } from '../data/memes'

// 梗图/表情包/神回复轮播墙(纯文字 emoji 大字,零图片依赖)。
export function MemeWall() {
  const [meme, setMeme] = useState<Meme>(() => getMeme())
  useEffect(() => {
    const id = setInterval(() => setMeme(getMeme()), 9000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="card">
      <h3>🖼️ 梗图墙 · 赛博毒鸡汤</h3>
      <div className="meme">
        <div className="big">{meme.big}</div>
        <div className="txt">{meme.text}</div>
      </div>
    </div>
  )
}
