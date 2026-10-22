import { type PostPublisher } from '../application/run-countdown'
import { callTwifork, createTwiforkPublisher } from './twifork-publisher'
import { createTwitterPublisher } from './twitter-publisher'

export function configuredPublisher(env = process.env): PostPublisher {
  const provider = env.X_PUBLISHER ?? 'twifork'
  if (provider === 'twifork')
    return createTwiforkPublisher(
      async (request) => await callTwifork(request, env)
    )
  if (provider === 'official') {
    return {
      publish: async (post) =>
        await createTwitterPublisher(
          (
            await import('./twitter-api')
          ).default
        ).publish(post)
    }
  }
  throw new Error('INVALID_X_PUBLISHER')
}
