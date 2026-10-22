import { spawn } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { type PostPublisher } from '../application/run-countdown'

export interface TwiforkResponse {
  ok: boolean
  id?: string
  username?: string
  userId?: string
  text?: string
  error?: string
}

const ROOT = resolvePath(__dirname, '../..')
const ERROR_CODES = new Set([
  'INVALID_REQUEST',
  'INVALID_POST',
  'INVALID_POST_ID',
  'SESSION_REQUIRED',
  'SESSION_EXPIRED',
  'ACCOUNT_MISMATCH',
  'ACCOUNT_LOCKED',
  'ACCOUNT_SUSPENDED',
  'PUBLICATION_ALREADY_ATTEMPTED',
  'PUBLICATION_NOT_CONFIRMED',
  'POLL_NOT_CONFIRMED',
  'RATE_LIMITED',
  'ACCESS_DENIED',
  'POST_REJECTED',
  'DUPLICATE_POST',
  'ENDPOINT_UNAVAILABLE',
  'DEPENDENCY_MISSING',
  'HANDSHAKE_FAILED',
  'TIMEOUT',
  'REQUEST_FAILED'
])

export async function callTwifork(
  request: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env
): Promise<TwiforkResponse> {
  const python =
    env.TWIFORK_PYTHON ??
    resolvePath(
      ROOT,
      '.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
    )
  return await new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [resolvePath(ROOT, 'scripts/twifork_bridge.py')],
      {
        cwd: ROOT,
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: env.PATH,
          SystemRoot: env.SystemRoot,
          HOME: env.HOME,
          TMP: env.TMP,
          TEMP: env.TEMP,
          LANG: 'C.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          X_AUTH_TOKEN: env.X_AUTH_TOKEN,
          X_CT0: env.X_CT0,
          X_EXPECTED_USERNAME: env.X_EXPECTED_USERNAME ?? 'contadoruerj',
          TWIFORK_JOURNAL_PATH:
            env.TWIFORK_JOURNAL_PATH ?? resolvePath(ROOT, 'var/twifork.sqlite')
        }
      }
    )
    let output = ''
    let timeout = false
    let overflow = false
    const timer = setTimeout(() => {
      timeout = true
      child.kill()
    }, 100000)
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString('utf8')
      if (output.length > 16384) {
        overflow = true
        child.kill()
      }
    })
    // Consume but never log arbitrary subprocess errors (may contain secrets).
    child.stderr.resume()
    child.stdin.on('error', () => {
      // Exit/error events below report a sanitized failure if Python exits early.
    })
    child.on('error', () => {
      clearTimeout(timer)
      reject(new Error('TWIFORK_PYTHON_UNAVAILABLE'))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (timeout) {
        reject(new Error('TWIFORK_TIMEOUT'))
        return
      }
      if (overflow) {
        reject(new Error('TWIFORK_INVALID_RESPONSE'))
        return
      }
      let result: TwiforkResponse
      try {
        result = JSON.parse(output) as TwiforkResponse
        if (!result || typeof result.ok !== 'boolean') throw new Error()
      } catch {
        reject(new Error('TWIFORK_INVALID_RESPONSE'))
        return
      }
      if (code !== 0 || !result.ok) {
        const error =
          result.error && ERROR_CODES.has(result.error)
            ? result.error
            : 'REQUEST_FAILED'
        reject(new Error(`TWIFORK_${error}`))
        return
      }
      resolve(result)
    })
    child.stdin.end(JSON.stringify(request))
  })
}

export function createTwiforkPublisher(
  execute: typeof callTwifork = callTwifork
): PostPublisher {
  return {
    async publish(post) {
      const result = await execute({ operation: 'publish', post })
      if (!result.ok || !result.id || !/^\d+$/.test(result.id))
        throw new Error('TWIFORK_PUBLICATION_NOT_CONFIRMED')
      return { id: result.id }
    }
  }
}
