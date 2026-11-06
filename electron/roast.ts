import { generateRoast, type RoastContext } from '../src/data/roasts'
import type { FishStatus } from '../src/lib/types'

// 主进程侧吐槽生成。默认用本地语料库(零 key)。
// 可选 AI: 设环境变量 MONEY_AI_ENDPOINT + MONEY_AI_KEY 时走外部 LLM(OpenAI 兼容)。
// 不在仓库内硬编码任何 key —— 只读环境变量。

const statusToMood: Record<FishStatus, Parameters<typeof generateRoast>[0]> = {
  idle: 'idle',
  entertainment: 'entertainment',
  switching: 'switching',
  working: 'working',
}

export async function makeRoast(
  status: FishStatus,
  ctx: RoastContext,
): Promise<string> {
  const local = generateRoast(statusToMood[status], ctx)

  const endpoint = process.env.MONEY_AI_ENDPOINT
  const key = process.env.MONEY_AI_KEY
  if (!endpoint || !key || status === 'working') return local

  try {
    const url = new URL(endpoint)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return local
    const prompt =
      `你是一个毒舌但搞笑的反摸鱼助手,风格是贴吧老哥+评论区神回复。` +
      `用户当前状态: ${status}。上下文: ${JSON.stringify(ctx)}。` +
      `用一句不超过40字的中文黑色幽默吐槽他,催他干活。只输出吐槽本身。`
    const res = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error', // 重定向不能把提示词与财务上下文转发给另一地址。
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.MONEY_AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 1.0,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return local
    const data: any = await res.json()
    const text: string | undefined = data?.choices?.[0]?.message?.content
    return text?.trim() || local
  } catch {
    return local // AI 失败一律降级到本地语料,绝不阻塞
  }
}
