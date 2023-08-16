import moment from 'moment'
import { PHRASES } from '../config/phrases'

const { NAME_OF_PERIOD, START_DATE, END_DATE } = process.env as Record<
  string,
  string
>

export function createTwitt() {
  const today = moment()
  const startDate = moment(START_DATE)
  const endDate = moment(END_DATE)

  const totalDays = endDate.diff(startDate, 'days') + 1
  const daysFromStart = today.diff(startDate, 'days') + 1
  const daysFromEnd = endDate.diff(today, 'days') + 1

  if (daysFromStart <= 0) throw new Error('COUNTDOWN_HAS_NOT_STARTED')
  if (daysFromEnd < 0) throw new Error('COUNTDOWN_HAS_ENDED')

  const remainingDays = daysFromEnd 
  const percentage = Math.round((daysFromStart / totalDays) * 10000) / 100
  const parsedPercentage = percentage > 100 ? 100 : percentage.toFixed(2)

  const phrase = PHRASES.find((phrase) => {
    return phrase.isInRange(percentage)
  })

  if (!phrase) throw new Error('PHRASE_NOT_FOUND')

  const parsedPhrase = phrase.text
    .replace(/{{percentage}}/g, parsedPercentage.toString())
    .replace(/{{period}}/g, NAME_OF_PERIOD)
    .replace(/{{days}}/g, remainingDays.toString())

  return parsedPhrase
}
