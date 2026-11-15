import { flagUrl } from '../art/flags'

/** A country's flag as a small picture beside its name. The name sits next to it, so the picture is decorative and has no alt text. Nothing is drawn for a code with no flag. */
export function Flag({ code }: { code: string }) {
  const src = flagUrl(code)
  return src ? <img className="flag" src={src} alt="" width={32} height={22} decoding="async" /> : null
}
