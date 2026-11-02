import { MEDIA_MAX_BYTES, MEDIA_SEND_SIDE, shrunkSize } from '../domain/media'

/**
 * Makes a phone photo small enough to send: redraws it at most `side` pixels on its longest side as a JPEG. Redrawing also turns the picture the right way up
 * (the camera's rotation note is applied) and leaves out the place and time the camera wrote into the file. Where the browser cannot do this the original is sent unchanged;
 * the server removes that information too and decides whether the file is accepted.
 */
export async function shrinkPicture(file: File, side: number = MEDIA_SEND_SIDE): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const size = shrunkSize(bitmap.width, bitmap.height, side)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    // A transparent PNG would turn black as a JPEG, so paint white first.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    // Keep the original only when it is already smaller and small enough to send.
    return blob && blob.size > 0 && (blob.size < file.size || file.size > MEDIA_MAX_BYTES) ? blob : file
  } catch {
    return file
  }
}
