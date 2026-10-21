const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const {
  ACADEMIC_CALENDAR,
  configuredCalendar
} = require('../dist/config/calendar')
const { configuredCounter } = require('../dist/config/counter')
const { createCounter } = require('../dist/core/countdown')
const {
  day,
  iso,
  metrics,
  localDate,
  validateCalendar
} = require('../dist/core/calendar')
const { runCountdown } = require('../dist/application/run-countdown')
const { createTwitterPublisher } = require('../dist/services/twitter-publisher')
const { toTwitterPayload } = require('../dist/services/post-payload')

const generate = createCounter(ACADEMIC_CALENDAR)

test('produção agenda em UTC sem publicar imediatamente nem carregar o cliente', () => {
  const script = `
    const assert = require('node:assert/strict');
    const Module = require('node:module');
    const original = Module._load;
    let scheduled = 0;
    Module._load = function(name, ...args) {
      if (name === 'node-schedule') return {
        RecurrenceRule: class {},
        scheduleJob(rule) {
          scheduled++;
          assert.equal(rule.hour, 22);
          assert.equal(rule.minute, 0);
          assert.equal(rule.second, 0);
          assert.equal(rule.tz, 'Etc/UTC');
        }
      };
      if (/twitter-api-v2|services[\\/]twitter-api$/.test(name)) throw new Error('UNEXPECTED_CLIENT');
      return original.call(this, name, ...args);
    };
    require('./dist/index.js');
    assert.equal(scheduled, 1);
  `
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 10000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DRY_RUN: 'false',
      UTC_HOUR_TO_POST: '22'
    }
  })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.doesNotMatch(result.stdout, /Post publicado|Prévia local/)
})

test('preserva a contagem inclusiva do período atual', () => {
  const post = generate('2026-10-21')
  assert.equal(post.remainingDays, 11)
  assert.equal(post.percentage.toFixed(2), '95.78')
  assert.match(post.text, /95,78% de 2026\.1/)
  assert.equal(post.kind, 'daily')
})

test('alterna pergunta e enquete através da troca de semestre', () => {
  const dates = ['2026-10-23', '2026-10-30', '2026-11-20', '2026-11-27']
  assert.deepEqual(
    dates.map((date) => generate(date).kind),
    ['question', 'poll', 'question', 'poll']
  )
  assert.equal(generate(dates[0]).poll, undefined)
  assert.equal(generate(dates[1]).poll.durationMinutes, 1440)
})

test('datas especiais e recesso não consomem a vez da interação', () => {
  assert.equal(generate('2026-11-27').kind, 'poll')
  assert.equal(generate('2026-12-04').event, 'uerj-birthday')
  assert.equal(generate('2026-12-11').kind, 'question')
  assert.equal(generate('2026-12-18').kind, 'poll')
  assert.equal(generate('2026-12-25').kind, 'vacation')
  assert.equal(generate('2027-01-01').kind, 'vacation')
  assert.equal(generate('2027-01-08').kind, 'vacation')
  assert.equal(generate('2027-01-15').kind, 'vacation')
  assert.equal(generate('2027-01-22').kind, 'question')
})

test('alternância é estável após recriar o contador e rotaciona o conteúdo', () => {
  const restart = createCounter(ACADEMIC_CALENDAR)
  assert.deepEqual(restart('2026-12-18'), generate('2026-12-18'))
  assert.notEqual(
    generate('2026-10-30').poll.options.join(),
    generate('2026-11-27').poll.options.join()
  )
  assert.notEqual(
    generate('2026-10-23').text.split('\n\n')[1],
    generate('2026-11-20').text.split('\n\n')[1]
  )
})

test('todas as interações previstas alternam, no máximo uma por semana', () => {
  let previous
  let previousDate
  for (let date = day('2026-10-21'); date <= day('2027-04-24'); date++) {
    const post = generate(iso(date))
    if (!['question', 'poll'].includes(post.kind)) continue
    assert.equal(new Date(iso(date) + 'T00:00:00Z').getUTCDay(), 5)
    assert.notEqual(post.kind, previous)
    if (previousDate) assert.ok(date - previousDate >= 7)
    previous = post.kind
    previousDate = date
  }
})

test('congela somente a porcentagem durante todo o recesso', () => {
  const before = generate('2026-12-22')
  for (let date = day('2026-12-23'); date <= day('2027-01-18'); date++) {
    const post = generate(iso(date))
    assert.equal(post.percentage, before.percentage)
    assert.equal(post.kind, 'vacation')
    assert.ok(post.remainingDays < before.remainingDays)
  }
  assert.equal(generate('2027-01-19').event, 'resume')
  assert.ok(generate('2027-01-19').percentage > before.percentage)
})

test('opção de dias corridos continua avançando no recesso', () => {
  const continuous = createCounter(ACADEMIC_CALENDAR, { freezeBreaks: false })
  assert.ok(
    continuous('2027-01-15').percentage > continuous('2027-01-05').percentage
  )
  assert.doesNotMatch(continuous('2027-01-05').text, /a barra também/)
})

test('intervalo informa o próximo semestre e singular correto', () => {
  const first = generate('2026-11-01')
  assert.equal(first.kind, 'vacation')
  assert.equal(first.remainingDays, 17)
  assert.match(first.text, /faltam 17 dias pra começar 2026\.2/)
  assert.equal(generate('2026-11-17').event, '404')
  assert.match(generate('2026-11-17').text, /falta 1 dia pra começar/)
  assert.equal(generate('2026-11-18').event, 'start')
})

test('encerra em 100% uma vez e aguarda novo calendário ao fim do último período', () => {
  const end = generate('2027-04-24')
  assert.equal(end.event, 'complete')
  assert.equal(end.percentage, 100)
  assert.match(end.text, /^100% de 2026\.2/)
  assert.equal(generate('2027-04-25'), null)
})

test('marcos e easter eggs ocorrem nas datas reais', () => {
  const expected = {
    '2026-06-16': '42',
    '2026-08-13': '666',
    '2026-08-19': '69',
    '2026-10-22': 'ten-days',
    '2026-10-25': 'seven-days',
    '2026-10-26': 'last-monday',
    '2026-10-29': 'three-days',
    '2026-10-31': 'complete',
    '2026-11-13': 'friday-13'
  }
  for (const [date, event] of Object.entries(expected))
    assert.equal(generate(date).event, event, date)
})

test('marcos percentuais disparam uma vez ao cruzar o percentual, inclusive com pausa', () => {
  for (const freezeBreaks of [true, false]) {
    const counter = createCounter(ACADEMIC_CALENDAR, { freezeBreaks })
    for (const period of ACADEMIC_CALENDAR) {
      for (const event of [
        '42',
        '666',
        '69',
        'half',
        'three-quarters',
        'ninety'
      ]) {
        const dates = []
        for (let date = day(period.start); date <= day(period.end); date++) {
          if (counter(iso(date)).event === event) dates.push(iso(date))
        }
        // A fixed calendar celebration may take precedence over a threshold.
        assert.ok(dates.length <= 1, `${period.name} ${event}: ${dates}`)
      }
    }
  }
})

test('todos os dias geram textos curtos, sem tokens ou contagens inválidas', () => {
  for (const freezeBreaks of [true, false]) {
    const counter = createCounter(ACADEMIC_CALENDAR, { freezeBreaks })
    for (let date = day('2026-03-01'); date <= day('2027-04-24'); date++) {
      const post = counter(iso(date))
      assert.ok(post.percentage >= 0 && post.percentage <= 100, post.date)
      assert.ok(post.remainingDays >= 0, post.date)
      assert.doesNotMatch(
        post.text,
        /undefined|NaN|\{\{|faltam 1 dia\b|\b1 dias\b/
      )
      // Conservative upper bound: non-ASCII code points count double.
      const upperBound = Array.from(post.text).reduce(
        (n, char) => n + (char.codePointAt(0) > 127 ? 2 : 1),
        0
      )
      assert.ok(upperBound <= 280, `${post.date}: ${upperBound}\n${post.text}`)
      if (post.poll) {
        assert.ok(
          post.poll.options.length >= 2 && post.poll.options.length <= 4
        )
        assert.equal(new Set(post.poll.options).size, post.poll.options.length)
        assert.ok(
          post.poll.options.every((option) => Array.from(option).length <= 25)
        )
      }
    }
  }
})

test('data civil usa São Paulo mesmo quando UTC já virou o dia', () => {
  assert.equal(localDate(new Date('2026-10-22T01:30:00Z')), '2026-10-21')
  assert.equal(localDate(new Date('2026-10-22T03:00:00Z')), '2026-10-22')
})

test('rejeita datas e calendários inválidos', () => {
  for (const date of ['2026-02-30', '2026-13-01', '', '2026-1-1'])
    assert.throws(() => day(date), /INVALID_DATE/)
  assert.throws(() => validateCalendar([]), /EMPTY_CALENDAR/)
  assert.throws(
    () => validateCalendar([...ACADEMIC_CALENDAR, ACADEMIC_CALENDAR[0]]),
    /INVALID_CALENDAR/
  )
  assert.throws(
    () => configuredCalendar({ NAME_OF_PERIOD: '2026.1' }),
    /INCOMPLETE_PERIOD_CONFIG/
  )
  assert.throws(
    () => configuredCounter({ FREEZE_DURING_BREAK: 'yes' }),
    /INVALID_FREEZE/
  )
  assert.throws(
    () => createCounter(ACADEMIC_CALENDAR, { communityWeekday: 8 }),
    /INVALID_COMMUNITY/
  )
  assert.throws(
    () =>
      validateCalendar([
        {
          name: 'x',
          start: '2026-01-01',
          end: '2026-02-01',
          breaks: [{ start: '2026-01-15', end: '2026-02-02' }]
        }
      ]),
    /INVALID_BREAK/
  )
})

test('configuração de datas conserva o próximo semestre e não altera o calendário original', () => {
  const calendar = configuredCalendar({
    NAME_OF_PERIOD: '2026.1',
    START_DATE: '2026-03-10',
    END_DATE: '2026-10-31'
  })
  assert.equal(calendar[0].start, '2026-03-10')
  assert.equal(calendar[1].name, '2026.2')
  assert.equal(ACADEMIC_CALENDAR[0].start, '2026-03-09')
  assert.equal(metrics(calendar[0], day('2026-03-09'), true).percentage, 0)
})

test('adapter envia uma enquete nativa e não anexa enquete à pergunta aberta', async () => {
  const requests = []
  const publisher = createTwitterPublisher({
    v2: {
      async tweet(payload) {
        requests.push(payload)
        return { data: { id: 'test-post' } }
      }
    }
  })
  const poll = generate('2026-10-30')
  await publisher.publish(poll)
  assert.deepEqual(requests[0], {
    text: poll.text,
    poll: { options: poll.poll.options, duration_minutes: 1440 }
  })
  assert.deepEqual(toTwitterPayload(generate('2026-10-23')), {
    text: generate('2026-10-23').text
  })
})

test('prévia e calendário encerrado nunca chamam o publicador', async () => {
  let calls = 0
  const publisher = {
    async publish() {
      calls++
      throw new Error('UNEXPECTED_NETWORK')
    }
  }
  assert.equal(
    (
      await runCountdown({
        date: '2026-10-30',
        generate,
        dryRun: true,
        publisher
      })
    ).status,
    'preview'
  )
  assert.equal(
    (
      await runCountdown({
        date: '2027-04-25',
        generate,
        dryRun: false,
        publisher
      })
    ).status,
    'calendar-ended'
  )
  assert.equal(calls, 0)
})

test('falha na publicação não gera sucesso nem nova tentativa automática', async () => {
  let calls = 0
  await assert.rejects(
    runCountdown({
      date: '2026-10-30',
      generate,
      dryRun: false,
      publisher: {
        async publish() {
          calls++
          throw new Error('API_403')
        }
      }
    }),
    /API_403/
  )
  assert.equal(calls, 1)
  await assert.rejects(
    runCountdown({
      date: '2026-10-30',
      generate,
      dryRun: false,
      publisher: {
        async publish() {
          return { id: '' }
        }
      }
    }),
    /NOT_CONFIRMED/
  )
})

test('modo de prévia real funciona sem carregar credenciais ou cliente do X', () => {
  const script = `
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-21T22:00:00Z'])); }
      static now() { return RealDate.parse('2026-10-21T22:00:00Z'); }
    };
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (/twitter-api-v2|services[\\/]twitter-api$/.test(name)) throw new Error('CLIENT_LOADED_IN_PREVIEW');
      return load.call(this, name, ...args);
    };
    require('./dist/index.js');
  `
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 10000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DRY_RUN: 'true',
      CONSUMER_KEY: '',
      CONSUMER_SECRET: '',
      ACCESS_TOKEN: '',
      ACCESS_TOKEN_SECRET: ''
    }
  })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /Prévia local/)
  assert.doesNotMatch(result.stdout, /Post publicado/)
})
