import { type SendTweetV2Params } from 'twitter-api-v2'
import { type CountdownPost } from '../core/countdown'

export function toTwitterPayload(post: CountdownPost): SendTweetV2Params {
  return {
    text: post.text,
    ...(post.poll
      ? {
          poll: {
            options: [...post.poll.options],
            duration_minutes: post.poll.durationMinutes
          }
        }
      : {})
  }
}
