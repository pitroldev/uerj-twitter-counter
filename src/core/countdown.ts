import { OPEN_QUESTIONS, POLLS, VOICES } from '../config/personality'
import {
  type AcademicPeriod,
  day,
  iso,
  metrics,
  validateCalendar,
  DAY
} from './calendar'

export type PostKind =
  | 'daily'
  | 'milestone'
  | 'easter-egg'
  | 'question'
  | 'poll'
  | 'vacation'
export interface CountdownPost {
  date: string
  period: string
  kind: PostKind
  event: string
  text: string
  percentage: number
  remainingDays: number
  poll?: { options: string[]; durationMinutes: number }
}
export interface CounterOptions {
  freezeBreaks?: boolean
  communityWeekday?: number
  communityStartDate?: string
}
export type Counter = (date: string) => CountdownPost | null
interface Special {
  kind: PostKind
  event: string
  message: string
}

const number = (n: number): string => n.toFixed(2).replace('.', ',')
const days = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`
const left = (n: number): string => `${n === 1 ? 'falta' : 'faltam'} ${days(n)}`
const weekday = (date: number): number => new Date(date * DAY).getUTCDay()
const shortDate = (date: number): string =>
  iso(date).slice(8) + '/' + iso(date).slice(5, 7)

function calendarEgg(date: number): Special | undefined {
  const value = iso(date)
  if (value.endsWith('-12-04'))
    return {
      kind: 'easter-egg',
      event: 'uerj-birthday',
      message:
        'hoje é aniversário da UERJ.\na gente envelhece junto. ela ganha história e a gente ganha olheira. parabéns, querida. 💙'
    }
  if (value.endsWith('-13') && weekday(date) === 5)
    return {
      kind: 'easter-egg',
      event: 'friday-13',
      message:
        'sexta-feira 13.\nse o aluno online abrir de primeira, desconfiem. hoje eu sou um bot supersticioso.'
    }
}

function special(
  period: AcademicPeriod,
  date: number,
  freezeBreaks: boolean
): Special | undefined {
  const current = metrics(period, date, freezeBreaks)
  if (date === day(period.end))
    return {
      kind: 'milestone',
      event: 'complete',
      message:
        '🚨 liberdade condicional concedida 🚨\no adm sobreviveu. o próximo período já tá preparando o recurso.'
    }
  if (date === day(period.start))
    return {
      kind: 'milestone',
      event: 'start',
      message:
        'começou.\no adm disse que dessa vez vai se organizar desde o começo. eu sou um bot, não sou ingênuo.'
    }
  if (current.pause) {
    const resume = day(current.pause.end) + 1
    const messages = [
      'até o bot tá de férias. a ansiedade é por conta de vocês.',
      'o adm mandou eu descansar. vou obedecer pela primeira vez.',
      'aulas em pausa. o grupo da turma também podia colaborar.',
      'tô aproveitando cada dia sem perguntar “isso cai na prova?”.'
    ]
    return {
      kind: 'vacation',
      event: date === day(current.pause.start) ? 'break-start' : 'break',
      message: `${
        messages[(date - day(current.pause.start)) % messages.length]
      }\naulas voltam em ${shortDate(resume)}.${
        freezeBreaks ? ' a barra também.' : ''
      }`
    }
  }
  if (period.breaks.some((pause) => day(pause.end) + 1 === date))
    return {
      kind: 'milestone',
      event: 'resume',
      message: 'voltamos.\no despertador voltou antes da vontade, mas voltamos.'
    }
  const dated = calendarEgg(date)
  if (dated) return dated
  const previous = metrics(period, date - 1, freezeBreaks).percentage
  const thresholds = [
    {
      value: 42,
      event: '42',
      kind: 'easter-egg' as const,
      message:
        'a resposta para a vida, o universo e quantos créditos faltam.\na secretaria ainda não aceitou essa resposta.'
    },
    {
      value: 66.6,
      event: '666',
      kind: 'easter-egg' as const,
      message:
        'se aparecer uma P3 no calendário, eu não tenho nada a ver com isso.'
    },
    {
      value: 69,
      event: '69',
      kind: 'easter-egg' as const,
      message: 'hoje eu vou só informar o número e me retirar.'
    },
    {
      value: 50,
      event: 'half',
      kind: 'milestone' as const,
      message:
        'metade do período vencida.\na outra metade tá fingindo que não viu o estado da gente.'
    },
    {
      value: 75,
      event: 'three-quarters',
      kind: 'milestone' as const,
      message:
        'três quartos do período.\no quarto restante o adm queria estar dormindo.'
    },
    {
      value: 90,
      event: 'ninety',
      kind: 'milestone' as const,
      message:
        '90% já foi.\nos últimos 10% os professores resolveram colocar 80% das entregas.'
    }
  ]
  const crossed = thresholds.find(
    (item) => previous < item.value && current.percentage >= item.value
  )
  if (crossed)
    return {
      kind: crossed.kind,
      event: crossed.event,
      message: crossed.message
    }
  if (current.remaining === 7)
    return {
      kind: 'easter-egg',
      event: 'seven-days',
      message:
        'o adm disse que dá pra aprender um semestre em uma semana.\naguardem os próximos capítulos.'
    }
  if (current.remaining === 10)
    return {
      kind: 'milestone',
      event: 'ten-days',
      message:
        'a contagem agora cabe nos dedos das mãos.\no número de pendências do adm, não.'
    }
  if (weekday(date) === 1 && day(period.end) - date < 7)
    return {
      kind: 'milestone',
      event: 'last-monday',
      message:
        'última segunda-feira do período.\numa segunda com perspectiva de futuro.'
    }
  if (current.remaining === 3)
    return {
      kind: 'milestone',
      event: 'three-days',
      message:
        'entramos oficialmente na fase “professor, posso conversar com você rapidinho?”.'
    }
}

export function createCounter(
  periods: AcademicPeriod[],
  options: CounterOptions = {}
): Counter {
  validateCalendar(periods)
  const freezeBreaks = options.freezeBreaks ?? true
  const communityWeekday = options.communityWeekday ?? 5
  const communityStart = day(options.communityStartDate ?? '2026-10-21')
  if (
    !Number.isInteger(communityWeekday) ||
    communityWeekday < 0 ||
    communityWeekday > 6
  ) {
    throw new Error('INVALID_COMMUNITY_WEEKDAY')
  }

  // Count eligible interactions, not calendar-week parity: special days and
  // breaks do not consume a turn. The result stays stable across restarts.
  const communitySlots = new Map<number, number>()
  for (const period of periods) {
    for (
      let date = Math.max(day(period.start), communityStart);
      date <= day(period.end);
      date++
    ) {
      if (
        weekday(date) === communityWeekday &&
        !special(period, date, freezeBreaks)
      ) {
        communitySlots.set(date, communitySlots.size)
      }
    }
  }

  return function generate(dateString: string): CountdownPost | null {
    const date = day(dateString)
    const period = periods.find(
      (item) => date >= day(item.start) && date <= day(item.end)
    )
    if (!period) {
      const next = periods.find((item) => day(item.start) > date)
      if (!next) return null
      const remaining = day(next.start) - date
      const dated = calendarEgg(date)
      const event = remaining === 1 ? '404' : dated?.event ?? 'between-periods'
      const messages = [
        'o bot tá de férias. o calendário, infelizmente, não.',
        'o próximo período tá ali na esquina. eu tô fingindo que não vi.',
        'tô descansando preventivamente. vai que dá pra acumular.',
        'o adm disse que dessa vez vai voltar descansado. vamos acompanhar.'
      ]
      const message =
        remaining === 1
          ? 'erro 404: férias não encontradas.\no adm pediu mais cinco minutinhos.'
          : dated?.message ?? messages[remaining % messages.length]
      return {
        date: dateString,
        period: next.name,
        kind: remaining === 1 || dated ? 'easter-egg' : 'vacation',
        event,
        percentage: 0,
        remainingDays: remaining,
        text: `${left(remaining)} pra começar ${next.name}.\n\n${message}`
      }
    }

    const current = metrics(period, date, freezeBreaks)
    const prefix =
      current.percentage >= 100
        ? `100% de ${period.name}. acabou.`
        : `${number(current.percentage)}% de ${period.name} concluído.\n${left(
            current.remaining
          )} pro fim do semestre.`
    const draft = (
      kind: PostKind,
      event: string,
      message: string
    ): CountdownPost => ({
      date: dateString,
      period: period.name,
      kind,
      event,
      text: `${prefix}\n\n${message}`,
      percentage: current.percentage,
      remainingDays: current.remaining
    })
    const occasion = special(period, date, freezeBreaks)
    if (occasion) return draft(occasion.kind, occasion.event, occasion.message)
    const slot = communitySlots.get(date)
    if (slot !== undefined) {
      const round = Math.floor(slot / 2)
      if (slot % 2 === 0)
        return draft(
          'question',
          'community-question',
          OPEN_QUESTIONS[round % OPEN_QUESTIONS.length]
        )
      const poll = POLLS[round % POLLS.length]
      return {
        ...draft('poll', 'community-poll', poll.question),
        poll: { options: [...poll.options], durationMinutes: 1440 }
      }
    }
    const voices =
      current.percentage < 50
        ? VOICES.early
        : current.percentage < 90
        ? VOICES.middle
        : VOICES.late
    return draft(
      'daily',
      'personality',
      voices[(date - day(period.start)) % voices.length]
    )
  }
}
