const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const {
  createPublicationHealth,
  safePublicationError
} = require('../dist/services/publication-health')

test('heartbeat preserva resultado e início do monitoramento após reiniciar', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'counter-health-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, 'health.json')
  let now = new Date('2026-10-22T21:00:00Z')
  const health = createPublicationHealth(path, 22, () => now)
  health.record({ date: '2026-10-22', status: 'publishing' })
  health.record({ date: '2026-10-22', status: 'published', id: '123456' })
  now = new Date('2026-10-23T00:00:00Z')
  createPublicationHealth(path, 22, () => now).heartbeat()
  const result = JSON.parse(readFileSync(path))
  assert.equal(result.monitoringSince, '2026-10-22T21:00:00.000Z')
  assert.equal(result.heartbeatAt, now.toISOString())
  assert.equal(result.lastRun.date, '2026-10-22')
  assert.equal(result.lastRun.status, 'published')
  assert.equal(result.lastRun.id, '123456')
})

test('erros livres e credenciais não entram na telemetria', () => {
  assert.equal(
    safePublicationError(new Error('TWIFORK_SESSION_EXPIRED')),
    'TWIFORK_SESSION_EXPIRED'
  )
  assert.equal(
    safePublicationError(new Error('TWIFORK_TIMEOUT')),
    'TWIFORK_TIMEOUT'
  )
  assert.equal(
    safePublicationError(new Error('auth_token=private')),
    'PUBLICATION_FAILED'
  )
  assert.equal(
    safePublicationError(new Error('TWIFORK_private')),
    'PUBLICATION_FAILED'
  )
})

test('estado corrompido não reinicia silenciosamente o prazo de monitoramento', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'counter-health-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, 'health.json')
  writeFileSync(path, '{broken')
  assert.throws(
    () => createPublicationHealth(path, 22),
    /INVALID_PUBLICATION_HEALTH/
  )
})

test('agendamento grava sucesso, falha e calendário encerrado no estado externo', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'counter-scheduled-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  for (const status of ['published', 'error', 'calendar-ended']) {
    const path = join(dir, status + '.json')
    const script = `
      const Module = require('node:module');
      const original = Module._load;
      Module._load = function(name, ...args) {
        if (name === 'node-schedule') return {
          RecurrenceRule: class {},
          scheduleJob(rule, post) { setImmediate(() => post().catch(() => { process.exitCode = 1; })); }
        };
        if (name === './config/counter') return {
          configuredCounter: () => () => process.env.SCENARIO === 'calendar-ended' ? null : { text: 'Teste', kind: 'daily' }
        };
        if (name === './services/configured-publisher') return {
          configuredPublisher: () => ({ publish: async () => {
            if (process.env.SCENARIO === 'error') throw new Error('TWIFORK_SESSION_EXPIRED');
            return { id: '123456' };
          } })
        };
        if (/twitter-api-v2|services[\\/]twitter-api$/.test(name)) throw new Error('UNEXPECTED_CLIENT');
        return original.call(this, name, ...args);
      };
      require('./dist/index.js');
    `
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DRY_RUN: 'false',
        PUBLICATION_HEALTH_PATH: path,
        SCENARIO: status
      }
    })
    assert.equal(result.status, 0, result.stderr)
    const saved = JSON.parse(readFileSync(path))
    assert.equal(saved.lastRun.status, status)
    if (status === 'published') assert.equal(saved.lastRun.id, '123456')
    if (status === 'error')
      assert.equal(saved.lastRun.error, 'TWIFORK_SESSION_EXPIRED')
  }
})
