import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { configuredCounter } from './config/counter'
import { day, iso, localDate } from './core/calendar'
import { type CountdownPost } from './core/countdown'

const args = process.argv.slice(2)
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  if (!args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error('MISSING_VALUE: ' + flag)
  return args[index + 1]
}

function preview(): void {
  const start = day(value('--from') ?? localDate(new Date()))
  const end = day(value('--to') ?? iso(start + 30))
  if (end < start || end - start > 730) throw new Error('INVALID_PREVIEW_RANGE')
  const generate = configuredCounter()
  if (args.includes('--update-lab')) {
    const from = day('2026-03-09')
    const to = day('2027-04-24')
    const plans: Record<string, CountdownPost[]> = {}
    for (const [mode, freeze] of [
      ['paused', 'true'],
      ['continuous', 'false']
    ]) {
      const counter = configuredCounter({
        ...process.env,
        FREEZE_DURING_BREAK: freeze
      })
      plans[mode] = []
      for (let date = from; date <= to; date++) {
        const post = counter(iso(date))
        if (post) plans[mode].push(post)
      }
    }
    const target = resolve('design/contador-lab.html')
    const html = readFileSync(target, 'utf8')
    const marker =
      /(<script type="application\/json" id="counter-schedule">)[\s\S]*?(<\/script>)/
    if (!marker.test(html)) throw new Error('LAB_SCHEDULE_MARKER_MISSING')
    const json = JSON.stringify(plans).replace(/</g, '\\u003c')
    writeFileSync(
      target,
      html.replace(
        marker,
        (_: string, open: string, close: string) => open + json + close
      ),
      'utf8'
    )
    console.log('Prévias do contador atualizadas no HTML.')
    return
  }
  const posts: CountdownPost[] = []
  for (let date = start; date <= end; date++) {
    const post = generate(iso(date))
    if (post) posts.push(post)
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(posts, null, 2))
    return
  }
  const labels = {
    daily: 'Personalidade',
    milestone: 'Marco',
    'easter-egg': 'Easter egg',
    question: 'Pergunta aberta',
    poll: 'Enquete',
    vacation: 'Férias do bot'
  }
  const output =
    '# Prévia do Contador UERJ\n\nGerada pelo código do contador. Nenhum post foi enviado ao X.\n\n' +
    posts
      .map(
        (post) =>
          `## ${post.date} · ${labels[post.kind]}\n\n${post.text
            .split('\n')
            .map((line) => (line ? '> ' + line : '>'))
            .join('\n')}\n` +
          (post.poll
            ? '\nEnquete de 24 horas:\n\n' +
              post.poll.options.map((option) => '- ' + option).join('\n') +
              '\n'
            : '')
      )
      .join('\n')
  const destination = value('--out')
  if (destination) {
    const target = resolve(destination)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, output, 'utf8')
    console.log(`${posts.length} prévias salvas em ${target}`)
  } else console.log(output)
}

try {
  preview()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PREVIEW_FAILED')
  process.exitCode = 1
}
