import { type AcademicPeriod, validateCalendar } from '../core/calendar'

// Calendário 2026 adequado pela Deliberação 38/2026.
// https://www.uerj.br/wp-content/uploads/2026/07/CA-2026_mes-a-mes-ADEQUA%C3%87AO-1.pdf
export const ACADEMIC_CALENDAR: AcademicPeriod[] = [
  { name: '2026.1', start: '2026-03-09', end: '2026-10-31', breaks: [] },
  {
    name: '2026.2',
    start: '2026-11-18',
    end: '2027-04-24',
    breaks: [{ start: '2026-12-23', end: '2027-01-18' }]
  }
]

export function configuredCalendar(
  env: NodeJS.ProcessEnv = process.env
): AcademicPeriod[] {
  const calendar = ACADEMIC_CALENDAR.map((period) => ({
    ...period,
    breaks: period.breaks.map((pause) => ({ ...pause }))
  }))
  const { NAME_OF_PERIOD: name, START_DATE: start, END_DATE: end } = env
  if ([name, start, end].some(Boolean)) {
    if (!name || !start || !end) throw new Error('INCOMPLETE_PERIOD_CONFIG')
    const current = calendar.find((period) => period.name === name)
    if (current) {
      current.start = start
      current.end = end
    } else {
      calendar.push({
        name,
        start,
        end,
        breaks: []
      })
    }
  }
  calendar.sort((a, b) => a.start.localeCompare(b.start))
  validateCalendar(calendar)
  return calendar
}
