// 吐槽 / 赛博毒鸡汤 语料引擎
// 本地生成,零依赖、零 API key。可选接入外部 AI(见 electron/roast.ts 的 provider 钩子)。
// 风格: 互联网热梗 + 贴吧老哥 + 评论区神回复 + 丧文化黑色幽默。

export type RoastMood = 'idle' | 'entertainment' | 'switching' | 'working' | 'random'

// —— 摸鱼被抓现行(发呆/离开) ——
const IDLE: string[] = [
  '检测到你已经石化 {min} 分钟,建议联系考古队。',
  '你不动,钱也不动,只有房东在动你的钱包。',
  '刚才那 {min} 分钟,你老板的劳斯莱斯又近了一个轮毂。',
  '发呆是免费的,但你这发呆的时间按 {rate}€/分钟在烧。',
  '已为你保留工位,以及一整套「假装在思考」的体面。',
  '你盯着屏幕的样子,像极了余额盯着你的样子。',
  '别动了,再不动 HR 都以为你交接完了。',
  '系统提示:您已进入「植物模式」,光合作用不发工资。',
  '这 {min} 分钟你什么都没产出,除了一身正气。',
  '醒醒,梦里啥都有,醒来啥都没,包括今天的进度。',
]

// —— 娱乐网站/App ——
const ENTERTAINMENT: string[] = [
  '又点开 {app}?你的梦想正在缓冲,进度 0%。',
  '{app} 不会让你暴富,只会让你富有「内容」。',
  '刷 {app} 的手速这么快,打工怎么不见你这么积极?',
  '别人在 {app} 上赚钱,你在 {app} 上花时间,公平。',
  '热搜第一也轮不到你的工资条上榜,关了吧。',
  '你在看别人的人生,你自己的 KPI 在看你。',
  '{app}:谢谢老板续费会员。你:我没充钱啊。{app}:你充的是时间。',
  '这条视频很好笑,你的银行卡余额更好笑。',
  '划走的不是视频,是你提前退休的可能性。',
  '在 {app} 里待越久,「财富自由」这四个字就越像方言。',
]

// —— 频繁切屏(假装很忙) ——
const SWITCHING: string[] = [
  '1 分钟切了 {count} 次屏,你这不是工作,是在玩闪现。',
  '切屏速度 MAX,产出速度 0,这波是纯特效。',
  '别切了,再切显卡都嫌你帧率高。',
  '你以为切屏=忙碌,老板以为切屏=没事干,你俩都对。',
  '窗口换得比男朋友还勤,内容产出比初恋还少。',
  '检测到「假装很忙」综合征晚期,药不能停,活也不能停。',
  '切来切去,唯一没切到的是「正在赚钱」那个窗口。',
]

// —— 正在专注工作(正向激励,但也阴阳怪气) ——
const WORKING: string[] = [
  '可以啊,这 {min} 分钟真在干活,稀有度:传说。',
  '保持住,你正在以 {rate}€/分钟的速度逼近做人。',
  '老板看了会沉默,因为他终于不用看了。',
  '专注的样子有点贵,继续,别停。',
  '今天的你,值得一杯不加冰的命运奖励。',
  '进度条在涨,房贷在跌,这才对味。',
  '别骄傲,刚才那一下是回光返照还是真努力,系统还在观察。',
]

// —— 通用毒鸡汤(随机弹) ——
const RANDOM: string[] = [
  '钱没了可以再赚,前提是你得去赚。',
  '你不是不想成功,你只是不想现在、不想这件事、不想动。',
  '梦想是用来实现的,不是用来当壁纸的。',
  '世界上最远的距离,是工资和你想要的生活。',
  '努力不一定成功,但摸鱼一定很爽,然后一定没钱。',
  '你的对手在熬夜,你的同事在卷,你的余额在哭。',
  '今天不努力,明天的你还是今天的你,只是更穷。',
  '别老说躺平,你那不叫躺平,叫躺穷。',
  '財富自由的第一步,是先把这个窗口前的活干了。',
  '你以为的岁月静好,是房东在替你负重前行。',
  '人生没有彩排,但你的工位天天在重播。',
  '焦虑解决不了问题,但干活可以解决焦虑。',
]

const POOL: Record<RoastMood, string[]> = {
  idle: IDLE,
  entertainment: ENTERTAINMENT,
  switching: SWITCHING,
  working: WORKING,
  random: RANDOM,
}

export interface RoastContext {
  min?: number // 摸鱼/工作分钟数
  rate?: number // 每分钟收入
  app?: string // 娱乐 app 名
  count?: number // 切屏次数
}

function fill(tpl: string, ctx: RoastContext): string {
  return tpl
    .replace('{min}', String(ctx.min ?? '几'))
    .replace('{rate}', ctx.rate != null ? ctx.rate.toFixed(2) : '一笔')
    .replace('{app}', ctx.app ?? '这玩意儿')
    .replace('{count}', String(ctx.count ?? '亿'))
}

// 避免连续重复同一条
let lastIndex = -1
export function generateRoast(mood: RoastMood, ctx: RoastContext = {}): string {
  const pool = POOL[mood] ?? RANDOM
  let i = Math.floor(Math.random() * pool.length)
  if (pool.length > 1 && i === lastIndex) i = (i + 1) % pool.length
  lastIndex = i
  return fill(pool[i], ctx)
}

export const ROAST_POOL = POOL
