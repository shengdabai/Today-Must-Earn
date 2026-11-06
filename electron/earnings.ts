import type { Config, EarningsState } from '../src/lib/types'

// 收入计算: 月薪 → 每分钟/每秒,叠加日历课程收入。
// 口径说明:课程收入视为月薪之外的额外收入(中文老师按课计费),
// 因此 totalToday 与 todayTarget 都用「相加」口径,保持一致(修审查 H3)。

export function perMinuteRate(config: Config): number {
  const minutesPerMonth = config.workdaysPerMonth * config.workHoursPerDay * 60
  if (minutesPerMonth <= 0) return 0
  return config.monthlySalary / minutesPerMonth
}

export function computeEarnings(
  config: Config,
  focusSeconds: number,
  lessonsToday: number,
  lifetimeEarned: number,
  lifetimeLessonIncome?: number,
): EarningsState {
  const perMinute = perMinuteRate(config)
  const perSecond = perMinute / 60
  const focusMinutes = focusSeconds / 60

  const salaryEarnedToday = perSecond * focusSeconds
  const lessonIncomeToday = lessonsToday * config.lessonIncome
  const totalToday = salaryEarnedToday + lessonIncomeToday

  // 今日目标 = 月薪折算到单个工作日 + 当天排课收入(与 total 同口径,都相加)
  const dailySalaryTarget =
    config.workdaysPerMonth > 0 ? config.monthlySalary / config.workdaysPerMonth : 0
  const todayTarget = Math.max(dailySalaryTarget + lessonIncomeToday, 1)

  // 生涯累计 = 月薪折算累计 + 已记录的各日课程收入。旧调用仍兼容今日收入。
  const lifetimeTotal = lifetimeEarned + (lifetimeLessonIncome ?? lessonIncomeToday)

  return {
    perMinute,
    perSecond,
    salaryEarnedToday,
    lessonsToday,
    lessonIncomeToday,
    totalToday,
    focusMinutes,
    todayTarget,
    lifetimeTotal,
  }
}
