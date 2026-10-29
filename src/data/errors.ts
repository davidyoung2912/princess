/** Why storage failed, in terms a screen can explain. */
export type StorageErrorCode = 'quota' | 'unavailable' | 'blocked' | 'corrupt'

export class StorageError extends Error {
  readonly code: StorageErrorCode
  constructor(code: StorageErrorCode, message: string = code) {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

/** Sorts a raw failure from the browser into a StorageError (quota full, private mode, upgrade blocked by another tab). */
export function mapStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : ''
  if (name === 'QuotaExceededError') return new StorageError('quota', 'Storage is full')
  if (name === 'BlockedError') return new StorageError('blocked', 'Another open copy of the app is using older data')
  if (name === 'VersionError' || name === 'DataError') return new StorageError('corrupt', 'Stored data is not readable')
  return new StorageError('unavailable', e instanceof Error ? e.message : 'Storage is not available')
}
