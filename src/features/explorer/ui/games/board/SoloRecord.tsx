import { t } from '../../../../../shared/i18n'
import { readRecord } from '../../../../../shared/settings/gamePrefs'

export function SoloRecord({ game, keyName }: { game: string; keyName: string }) {
  const r = readRecord(game, keyName)
  return <p className="muted">{t('bd.solo.record', { w: r.w, l: r.l })}{r.best ? ` ${t('bd.solo.best', { n: r.best })}` : ''}</p>
}
