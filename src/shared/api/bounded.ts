import { TimeoutError, backoffMs, isRetryable, sleep, withTimeout } from '../data/outbox'
import { ApiError, isApiError } from './errors'

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

export interface RetryOptions {
  /** Extra tries after the first. */
  retries?: number
  /** Wait before retry number `attempt` (0 first). */
  delayMs?: (attempt: number) => number
  sleep?: (ms: number) => Promise<void>
  /** Return false to stop early (the screen has moved on). */
  keepGoing?: () => boolean
}

/**
 * Runs a read, and tries again with growing gaps when the link let it down (PERF-04). Only for reads: a change must not be repeated
 * blindly, so those go through the outbox instead.
 */
export async function withRetries<T>(load: () => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const retries = o.retries ?? LOAD_RETRIES
  const delay = o.delayMs ?? ((n: number) => backoffMs(n))
  const wait = o.sleep ?? sleep
  for (let attempt = 0; ; attempt++) {
    try {
      return await load()
    } catch (e) {
      // A phone that knows it is offline gains nothing from waiting and trying again: say so now, so the saved copy can be shown at once.
      if (attempt >= retries || !(isApiError(e) && isRetryable(e.code)) || e.code === 'offline' || o.keepGoing?.() === false) throw e
      await wait(delay(attempt))
      if (o.keepGoing?.() === false) throw e
    }
  }
}

export const LOAD_RETRIES = 2
