import { CircleCheck, OctagonAlert, TriangleAlert } from './icons'
import { t } from '../i18n'
import type { TileLine } from '../domain/tileLive'

const ICONS = { ok: CircleCheck, warn: TriangleAlert, urgent: OctagonAlert } as const

/** A tile's live line. A line that asks for a look carries an icon and a spoken "Needs attention", so it never relies on colour alone. */
export function TileLiveLine({ line }: { line: TileLine }) {
  const Icon = line.tone === 'neutral' ? null : ICONS[line.tone]
  return (
    <strong className={`tile-live tile-live--${line.tone}`}>
      {Icon && <Icon className="tile-live__icon" size={14} aria-hidden="true" />}
      {(line.tone === 'warn' || line.tone === 'urgent') && <span className="visually-hidden">{t('stage.tile.attention')}: </span>}
      {line.text}
    </strong>
  )
}
