import { type CountdownPost } from '../core/countdown'

export interface PostPublisher {
  publish: (post: CountdownPost) => Promise<{ id: string }>
}

export type CountdownResult =
  | { status: 'calendar-ended' }
  | { status: 'preview'; post: CountdownPost }
  | { status: 'published'; post: CountdownPost; id: string }

export async function runCountdown(input: {
  date: string
  generate: (date: string) => CountdownPost | null
  dryRun: boolean
  publisher?: PostPublisher
}): Promise<CountdownResult> {
  const post = input.generate(input.date)
  if (!post) return { status: 'calendar-ended' as const }
  if (input.dryRun) return { status: 'preview' as const, post }
  if (!input.publisher) throw new Error('PUBLISHER_REQUIRED')
  const result = await input.publisher.publish(post)
  if (!result.id) throw new Error('PUBLICATION_NOT_CONFIRMED')
  return { status: 'published' as const, post, id: result.id }
}
