import { createCounter, type Counter } from '../core/countdown'
import { configuredCalendar } from './calendar'

export function configuredCounter(
  env: NodeJS.ProcessEnv = process.env
): Counter {
  if (
    env.FREEZE_DURING_BREAK &&
    !['true', 'false'].includes(env.FREEZE_DURING_BREAK)
  ) {
    throw new Error('INVALID_FREEZE_DURING_BREAK')
  }
  return createCounter(configuredCalendar(env), {
    freezeBreaks: env.FREEZE_DURING_BREAK !== 'false',
    communityStartDate: env.COMMUNITY_START_DATE ?? '2026-10-21',
    communityWeekday: env.COMMUNITY_WEEKDAY ? Number(env.COMMUNITY_WEEKDAY) : 5
  })
}
