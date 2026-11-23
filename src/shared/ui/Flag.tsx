import { flagUrl } from '../art/flags'

/** A country's flag as a small picture beside its name. The name sits next to it, so the picture is decorative and has no alt text. Nothing is drawn for a code with no flag. */
export function Flag({ code, large }: { code: string; large?: boolean }) {
  const src = flagUrl(code)
  return src ? <img className={`flag${large ? ' flag--lg' : ''}`} src={src} alt="" width={large ? 56 : 32} height={large ? 38 : 22} decoding="async" /> : null
}
