import { type SendTweetV2Params } from 'twitter-api-v2'
import { type PostPublisher } from '../application/run-countdown'
import { toTwitterPayload } from './post-payload'

interface TwitterClient {
  v2: {
    tweet: (payload: SendTweetV2Params) => Promise<{ data: { id: string } }>
  }
}

export function createTwitterPublisher(client: TwitterClient): PostPublisher {
  return {
    async publish(post) {
      const response = await client.v2.tweet(toTwitterPayload(post))
      return { id: response.data.id }
    }
  }
}
