import { pillIcon } from './pillIcons'

/** The small decorative icon for a page-jump pill, and (with `heading`) the same icon in bold beside the section title it jumps to; the words stay the accessible name. */
export function PillIcon({ label, id, heading }: { label: string; id?: string; heading?: boolean }) {
  const Icon = pillIcon(label, id)
  return heading
    ? <Icon className="naut-jump__icon sec-icon" size="0.85em" strokeWidth={3} aria-hidden="true" />
    : <Icon className="naut-jump__icon" size={16} aria-hidden="true" />
}
