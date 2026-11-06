import { execFile } from 'node:child_process'

// 读取 Apple 日历今天的事件,统计「中文课」节数。
// 走 osascript 调用日历 App,无第三方依赖。首次需用户在系统设置授予日历权限。

function runOsascript(script: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 15000 }, (err, stdout) => {
      if (err) {
        resolve(null) // 空日历是成功的空字符串;失败必须保留区别。
        return
      }
      resolve(stdout.trim())
    })
  })
}

// 返回今天所有日历事件标题(用换行分隔)
async function todayEventTitles(): Promise<string[] | null> {
  const script = `
set output to ""
set today to current date
set hours of today to 0
set minutes of today to 0
set seconds of today to 0
set tomorrow to today + (1 * days)
tell application "Calendar"
  repeat with cal in calendars
    set evs to (every event of cal whose start date ≥ today and start date < tomorrow)
    repeat with ev in evs
      set output to output & (summary of ev) & "\n"
    end repeat
  end repeat
end tell
return output`
  const out = await runOsascript(script)
  if (out === null) return null
  if (!out) return []
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

export interface CalendarResult {
  lessons: number
  available: boolean // 是否成功读到日历(权限/可用性)
}

export async function countLessonsToday(keyword: string): Promise<CalendarResult> {
  try {
    const titles = await todayEventTitles()
    // 列出日历成功不代表事件查询成功;失败时让主进程保留同日缓存。
    if (titles === null) return { lessons: 0, available: false }
    const kw = keyword.trim()
    const lessons = kw
      ? titles.filter((t) => t.includes(kw)).length
      : titles.length
    return { lessons, available: true }
  } catch {
    return { lessons: 0, available: false }
  }
}
