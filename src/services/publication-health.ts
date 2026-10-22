import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ERROR_CODES } from './twifork-publisher'

export interface PublicationRun {
  date: string
  at: string
  status: 'publishing' | 'published' | 'error' | 'calendar-ended'
  id?: string
  error?: string
}

export interface PublicationHealth {
  schema: 1
  monitoringSince: string
  heartbeatAt: string
  scheduledHourUTC: number
  lastRun?: PublicationRun
}

export function safePublicationError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (
    message.startsWith('TWIFORK_') &&
    (ERROR_CODES.has(message.slice(8)) ||
      ['PYTHON_UNAVAILABLE', 'INVALID_RESPONSE'].includes(message.slice(8)))
  )
    return message
  return 'PUBLICATION_FAILED'
}

/** A local, sanitized heartbeat. A separate host decides when to alert. */
export function createPublicationHealth(
  path: string,
  hour: number,
  now: () => Date = () => new Date()
): {
  heartbeat: () => void
  record: (run: Omit<PublicationRun, 'at'>) => void
} {
  const initial = now().toISOString()
  const state: PublicationHealth = {
    schema: 1,
    monitoringSince: initial,
    heartbeatAt: initial,
    scheduledHourUTC: hour
  }
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8')) as PublicationHealth
    if (
      saved.schema !== 1 ||
      !Number.isFinite(Date.parse(saved.monitoringSince)) ||
      (saved.lastRun &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(saved.lastRun.date) ||
          !['publishing', 'published', 'error', 'calendar-ended'].includes(
            saved.lastRun.status
          )))
    )
      throw new Error('INVALID_PUBLICATION_HEALTH')
    state.monitoringSince = saved.monitoringSince
    if (saved.lastRun) {
      state.lastRun = {
        date: saved.lastRun.date,
        at: saved.lastRun.at,
        status: saved.lastRun.status,
        ...(/^\d+$/.test(saved.lastRun.id ?? '')
          ? { id: saved.lastRun.id }
          : {}),
        ...(saved.lastRun.error
          ? { error: safePublicationError(new Error(saved.lastRun.error)) }
          : {})
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error('INVALID_PUBLICATION_HEALTH')
  }
  const heartbeat = (): void => {
    state.heartbeatAt = now().toISOString()
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(path + '.tmp', JSON.stringify(state) + '\n', { mode: 0o600 })
    renameSync(path + '.tmp', path)
  }
  heartbeat()
  return {
    heartbeat,
    record(run) {
      state.lastRun = { ...run, at: now().toISOString() }
      heartbeat()
    }
  }
}
