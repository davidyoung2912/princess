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

/** Offers a picture to the share sheet where files can be shared, otherwise saves it to the device. */
export async function sendPicture(png: Blob, name: string, title: string): Promise<SendResult> {
  const file = new File([png], name, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared' }
    const url = URL.createObjectURL(png)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}
