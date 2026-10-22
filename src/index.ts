import dotenv from 'dotenv'

import nodeSchedule from 'node-schedule'
import { configuredCounter } from './config/counter'
import { localDate } from './core/calendar'
import { runCountdown } from './application/run-countdown'
import { configuredPublisher } from './services/configured-publisher'
dotenv.config()

const generate = configuredCounter()
const nodeEnv = process.env.NODE_ENV?.trim()
const dryRun =
  process.env.DRY_RUN === 'true' ||
  nodeEnv === 'development' ||
  nodeEnv === 'test'
const log = (...values: unknown[]): void => {
  console.log(new Date().toISOString(), ...values)
}

async function post(): Promise<void> {
  try {
    const publisher = dryRun ? undefined : configuredPublisher()
    const result = await runCountdown({
      date: localDate(new Date()),
      generate,
      dryRun,
      publisher
    })
    if (result.status === 'calendar-ended') {
      log(
        'Calendário encerrado. Cadastre o próximo período antes de retomar as publicações.'
      )
    } else if (result.status === 'preview') {
      log('Prévia local:', JSON.stringify(result.post, null, 2))
    } else {
      log('Post publicado:', result.id, result.post.kind)
    }
  } catch (err) {
    log(
      'Erro ao postar:',
      err instanceof Error ? err.message : 'Falha desconhecida'
    )
    if (dryRun) process.exitCode = 1
  }
}

function init(): void {
  if (dryRun) {
    void post()
    return
  }

  const rule = new nodeSchedule.RecurrenceRule()
  const hour = Number(process.env.UTC_HOUR_TO_POST ?? '22')
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    throw new Error('INVALID_UTC_HOUR_TO_POST')
  rule.tz = 'Etc/UTC'
  rule.hour = hour
  rule.minute = 0
  rule.second = 0
  nodeSchedule.scheduleJob(rule, post)

  log(
    `Inicializado. Publicações diárias às ${hour}:00 UTC; calendário em America/Sao_Paulo.`
  )
}

init()
