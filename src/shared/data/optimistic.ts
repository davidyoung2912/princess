/**
 * Shows a change at once and keeps it only if the server agrees (PERF-04). `apply` shows the new state, `commit` saves it, and
 * `rollback` puts the old state back when saving fails. Resolves true when saved; the error is passed on after the rollback.
 */
export async function optimistic<T>(apply: () => void, commit: () => Promise<T>, rollback: () => void): Promise<T> {
  apply()
  try {
    return await commit()
  } catch (e) {
    rollback()
    throw e
  }
}
