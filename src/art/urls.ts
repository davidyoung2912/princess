import { artPath, type ArtFile } from './manifest'

const FILES = import.meta.glob('../assets/art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** The URL of a picture, or undefined when the file is not there (the picture is then simply left out). */
export function artUrl(f: ArtFile): string | undefined {
  return FILES[`../assets/art/${artPath(f)}`]
}
