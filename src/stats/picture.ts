import type { StatsReport } from '../api/statsTypes'
import { highlightItems } from './share'
import type { ResolveRoute } from './share'

export interface PictureLine { label: string; value: string; joke: boolean }

/** The rows on the picture: the highlight stats, a made-up one flagged so it is marked on the picture itself. At most `max`. */
export function pictureLines(report: StatsReport, resolve: ResolveRoute, showJokes: boolean, max = 6): PictureLine[] {
  return highlightItems(report).filter((s) => showJokes || !s.joke).slice(0, max).map((s) => ({ label: s.label, value: s.route ? resolve(s.route) : s.value, joke: s.joke }))
}

/** Breaks text into lines no wider than `width` as measured by `measure`; a word wider than the line gets a line to itself. */
export function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > width) { lines.push(line); line = word } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const SIZE = 1080

/** Draws the stats picture (a square card) and returns it as a PNG. Nothing is uploaded: it is made on this device. */
export async function drawPicture(report: StatsReport, lines: readonly PictureLine[], title: string, madeUp: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const g = canvas.getContext('2d')
  if (!g) return null
  const grad = g.createLinearGradient(0, 0, SIZE, SIZE)
  grad.addColorStop(0, '#0b2a4a')
  grad.addColorStop(1, '#1d5a8a')
  g.fillStyle = grad
  g.fillRect(0, 0, SIZE, SIZE)
  g.fillStyle = '#ffffff'
  g.font = '700 64px system-ui, sans-serif'
  let y = 150
  for (const l of wrap(title, SIZE - 160, (s) => g.measureText(s).width)) { g.fillText(l, 80, y); y += 76 }
  g.font = '400 36px system-ui, sans-serif'
  g.fillStyle = '#cfe6f7'
  y += 10
  for (const l of wrap(report.headline, SIZE - 160, (s) => g.measureText(s).width)) { g.fillText(l, 80, y); y += 48 }
  y += 30
  for (const line of lines) {
    g.fillStyle = line.joke ? '#ffe08a' : '#ffffff'
    g.font = '400 32px system-ui, sans-serif'
    g.fillText(line.joke ? `${line.label} (${madeUp})` : line.label, 80, y)
    g.font = '700 54px system-ui, sans-serif'
    g.fillText(line.value, 80, y + 62)
    y += 130
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}
