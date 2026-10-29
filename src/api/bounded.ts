import { TimeoutError, withTimeout } from '../data/outbox'
import { ApiError } from './errors'

/** How long a screen waits for the ship's link before it stops and says so (PERF-04). Satellite links are slow, not usually this slow. */
export const CALL_TIMEOUT_MS = 20_000

/** Waits for a call, but not for ever: a stalled link ends as a retryable `timeout` error, so the screen can show its saved copy or offer to try again. */
export async function bounded<T>(work: Promise<T>, ms: number = CALL_TIMEOUT_MS): Promise<T> {
  try {
    return await withTimeout(work, ms)
  } catch (e) {
    throw e instanceof TimeoutError ? new ApiError('timeout') : e
  }
}
