export interface AcademicBreak {
  start: string
  end: string
}

export interface AcademicPeriod {
  name: string
  start: string
  end: string
  breaks: AcademicBreak[]
}

export interface CalendarMetrics {
  percentage: number
  remaining: number
  elapsed: number
  total: number
  pause?: AcademicBreak
}

export const DAY = 86_400_000

export function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('INVALID_DATE: ' + value)
  const parsed = Date.parse(value + 'T00:00:00Z')
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('INVALID_DATE: ' + value)
  }
  return parsed / DAY
}

export function iso(value: number): string {
  return new Date(value * DAY).toISOString().slice(0, 10)
}

export function localDate(now: Date, timeZone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone
  }).formatToParts(now)
  const part = (type: string): string => {
    const entry = parts.find((item) => item.type === type)
    if (!entry) throw new Error('MISSING_DATE_PART: ' + type)
    return entry.value
  }
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validateCalendar(periods: AcademicPeriod[]): void {
  if (!periods.length) throw new Error('EMPTY_CALENDAR')
  const names = new Set<string>()
  let previousEnd = -Infinity
  for (const period of periods) {
    const start = day(period.start)
    const end = day(period.end)
    if (
      !period.name.trim() ||
      names.has(period.name) ||
      end < start ||
      start <= previousEnd
    ) {
      throw new Error('INVALID_CALENDAR: ' + period.name)
    }
    let previousBreak = start - 1
    for (const pause of period.breaks) {
      const a = day(pause.start)
      const b = day(pause.end)
      if (
        a < start ||
        b > end ||
        a > b ||
        a <= previousBreak ||
        a === start ||
        b === end
      ) {
        throw new Error('INVALID_BREAK: ' + period.name)
      }
      previousBreak = b
    }
    previousEnd = end
    names.add(period.name)
  }
}

export function metrics(
  period: AcademicPeriod,
  date: number,
  freezeBreaks: boolean
): CalendarMetrics {
  const start = day(period.start)
  const end = day(period.end)
  const excluded = (until: number): number =>
    freezeBreaks
      ? period.breaks.reduce(
          (sum, pause) =>
            sum +
            Math.max(0, Math.min(day(pause.end), until) - day(pause.start) + 1),
          0
        )
      : 0
  const total = end - start + 1 - excluded(end)
  const elapsed = Math.max(
    0,
    Math.min(
      total,
      Math.min(date, end) - start + 1 - excluded(Math.min(date, end))
    )
  )
  const pause = period.breaks.find(
    (item) => date >= day(item.start) && date <= day(item.end)
  )
  return {
    percentage: (elapsed / total) * 100,
    remaining: Math.max(0, end - date + 1),
    elapsed,
    total,
    pause
  }
}
