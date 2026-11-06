// 梗图 / 表情包 / 评论区神回复 语料
// 纯文字梗(emoji 大字报形式),零图片依赖。可在 MemeWall 轮播。

export interface Meme {
  big: string // 大字 emoji / 符号
  text: string // 神回复文案
}

export const MEMES: Meme[] = [
  { big: '🗿', text: '别问,问就是在忙。忙着没钱。' },
  { big: '💸', text: '钱是身外之物 —— 在别人身外。' },
  { big: '🛌', text: '躺平不可怕,可怕的是躺平还没钱躺。' },
  { big: '🤡', text: '上班是为了赚钱,赚钱是为了不上班,逻辑闭环,我是小丑。' },
  { big: '🐟', text: '今日摸鱼报告: 鱼很满意。钱包很受伤。' },
  { big: '📉', text: '我的努力曲线和我的发际线,一个跌一个退。' },
  { big: '🔥', text: '工资还没焐热,房贷已经把它带走了。' },
  { big: '🥲', text: '我不是社恐,我是穷恐,见到消费就害怕。' },
  { big: '⏰', text: '时间就是金钱,所以我一直很穷,因为我一直在浪费时间。' },
  { big: '🧱', text: '搬砖不能让你致富,但能让你知道致富有多难。' },
  { big: '🎰', text: '梦想暴富的概率,和现在不干活的程度成反比。' },
  { big: '🪙', text: '一分耕耘一分收获,你今天耕耘了吗?还是只耘了寂寞。' },
  { big: '🚀', text: '别人的事业蒸蒸日上,你的体重蒸蒸日上。' },
  { big: '🧊', text: '冷静一下,你的银行卡也很冷静,一直保持低温。' },
  { big: '🪤', text: '「就刷五分钟」是这个时代最大的庞氏骗局。' },
  { big: '🏖️', text: '想去海边度假?先把这个月的活变成度假基金。' },
  { big: '💀', text: '工位如战场,而你正在用摸鱼缴械投降。' },
  { big: '🧠', text: '你的脑子很好,只是开机比较慢,而且经常待机。' },
]

let last = -1
export function getMeme(): Meme {
  let i = Math.floor(Math.random() * MEMES.length)
  if (i === last) i = (i + 1) % MEMES.length
  last = i
  return MEMES[i]
}
