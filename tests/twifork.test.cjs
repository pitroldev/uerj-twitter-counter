const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  callTwifork,
  createTwiforkPublisher
} = require('../dist/services/twifork-publisher')
const { configuredPublisher } = require('../dist/services/configured-publisher')
const { configuredCounter } = require('../dist/config/counter')

test('twifork recebe enquete e pergunta sem perder conteúdo Unicode', async () => {
  const requests = []
  const publisher = createTwiforkPublisher(async (request) => {
    requests.push(request)
    return { ok: true, id: '123456' }
  })
  const generate = configuredCounter({})
  for (const date of ['2026-10-23', '2026-10-30']) {
    const post = generate(date)
    assert.deepEqual(await publisher.publish(post), { id: '123456' })
    assert.deepEqual(requests.at(-1), { operation: 'publish', post })
  }
})

test('sem sessão o subprocesso real falha sem expor segredos nem chamar o X', async () => {
  await assert.rejects(
    callTwifork(
      { operation: 'check' },
      {
        ...process.env,
        X_AUTH_TOKEN: '',
        X_CT0: '',
        CONSUMER_SECRET: 'private-test-value'
      }
    ),
    /^Error: TWIFORK_SESSION_REQUIRED$/
  )
})

test('resposta sem ID válido não conta como publicação', async () => {
  for (const id of ['', 'undefined', 'secret-response']) {
    const publisher = createTwiforkPublisher(async () => ({ ok: true, id }))
    await assert.rejects(
      publisher.publish(configuredCounter({})('2026-10-30')),
      /NOT_CONFIRMED/
    )
  }
})

test('falha do twifork nunca aciona o SDK pago', async () => {
  const publisher = configuredPublisher({
    ...process.env,
    X_PUBLISHER: undefined,
    X_AUTH_TOKEN: '',
    X_CT0: ''
  })
  await assert.rejects(
    publisher.publish(configuredCounter({})('2026-10-30')),
    /TWIFORK_SESSION_REQUIRED/
  )
  assert.throws(
    () => configuredPublisher({ X_PUBLISHER: 'typo' }),
    /INVALID_X_PUBLISHER/
  )
})
