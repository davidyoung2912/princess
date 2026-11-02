import { useEffect, useRef, useState } from 'react'

/** Saves text the guest asked for as a file (calendar files); nothing is uploaded. */
export function downloadText(name: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** The guest picks a photo; it is read in the browser only (an object URL), and is dropped when they leave. */
export function usePickedPhoto(): { photo: HTMLImageElement | null; pick: (file: File | undefined) => void; clear: () => void } {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const url = useRef<string | null>(null)
  const drop = () => { if (url.current) URL.revokeObjectURL(url.current); url.current = null }
  useEffect(() => drop, [])
  const pick = (file: File | undefined) => {
    drop()
    if (!file || !file.type.startsWith('image/')) { setPhoto(null); return }
    url.current = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => setPhoto(img)
    img.src = url.current
  }
  return { photo, pick, clear: () => { drop(); setPhoto(null) } }
}
