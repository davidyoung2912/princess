import { useMemo } from 'react'
import * as QRCode from 'qrcode'

/** A QR code drawn on the device as one SVG path, so it works with no signal and prints sharply. Always black on white, whatever the theme, so scanners can read it. */
export function QrCode({ text, label, className }: { text: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const m = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
    let d = ''
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(y, x)) d += `M${x} ${y}h1v1h-1z`
    return { size: m.size, path: d }
  }, [text])
  const box = size + 8
  return (
    <svg className={['qr', className ?? ''].filter(Boolean).join(' ')} viewBox={`0 0 ${box} ${box}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={box} height={box} fill="#fff" />
      <path d={path} transform="translate(4 4)" fill="#000" />
    </svg>
  )
}
