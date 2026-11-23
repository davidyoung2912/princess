export type SendResult = 'shared' | 'copied' | 'failed' | null

/** Offers the text to the phone's share sheet, or copies it where there is none. Null when the guest closed the sheet without choosing. */
export async function sendText(text: string, title: string): Promise<SendResult> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared' }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}
