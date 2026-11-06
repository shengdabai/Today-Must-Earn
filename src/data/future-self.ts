// 「未来的自己」随机发来消息催你干活
// 设定: 来自 N 年后的你,有时富有有时落魄,语气从恳求到威胁不等。

export interface FutureMessage {
  from: string // 发件人署名
  text: string
  tone: 'beg' | 'threat' | 'regret' | 'flex' | 'warn'
}

const MESSAGES: FutureMessage[] = [
  { from: '3 年后的你', tone: 'beg', text: '求你了,现在那点活真不难,别让我 3 年后还在还这个月的花呗。' },
  { from: '5 年后的你', tone: 'regret', text: '我现在最后悔的,就是那个本可以努力的下午,你正坐在里面。' },
  { from: '10 年后的你', tone: 'flex', text: '如果你现在开始干,10 年后的我能请你吃饭。否则,我俩一起吃土。' },
  { from: '退休的你', tone: 'warn', text: '我没能退休。因为有个家伙,在每个该干活的时刻,选择了摸鱼。' },
  { from: '2 年后的你', tone: 'threat', text: '再划水,我就把你现在喜欢的那个人,在 2 年后弄丢。试试看。' },
  { from: '明年的你', tone: 'beg', text: '哥,就这一个任务,做完它,我明年的体检报告会好看很多。' },
  { from: '中年的你', tone: 'regret', text: '小时候我以为长大就有钱了,后来发现,得长大且努力才行。你在哪一步卡住了?' },
  { from: '富有的你', tone: 'flex', text: '我现在住在海边。秘诀很简单: 你现在正在逃避的那件事,我当年做了。' },
  { from: '破产的你', tone: 'warn', text: '别学我。我也曾经觉得「就摸一会儿」,然后一会儿变成了一辈子。' },
  { from: '下个月的你', tone: 'threat', text: '工资快发了。你猜,是发给努力的你,还是补偿摸鱼的你的房东?' },
  { from: '7 年后的你', tone: 'beg', text: '七年就是一辈子。你正在浪费的这一辈子,我这边能看到结局。回头吧。' },
  { from: '凌晨 3 点的你', tone: 'regret', text: '又是我替你加班。白天的你摸鱼一时爽,凌晨的我火葬场。' },
  { from: '梦想成真的你', tone: 'flex', text: '我替你实现了那个梦。代价是: 你得先把现在这个破窗口里的事做完。' },
  { from: '同龄人A', tone: 'warn', text: '隔壁老王上岸了,你还在岸边喂鱼。鱼: 谢谢款待。' },
]

let last = -1
export function getFutureMessage(): FutureMessage {
  let i = Math.floor(Math.random() * MESSAGES.length)
  if (i === last) i = (i + 1) % MESSAGES.length
  last = i
  return MESSAGES[i]
}

export const FUTURE_MESSAGES = MESSAGES
