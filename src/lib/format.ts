export function money(n: number, currency = '€'): string {
  return `${currency}${n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, (part / total) * 100)
}

export function shortMoney(n: number, currency = '€'): string {
  if (n >= 10000) return `${currency}${(n / 10000).toFixed(1)}万`
  return `${currency}${Math.round(n).toLocaleString('zh-CN')}`
}
