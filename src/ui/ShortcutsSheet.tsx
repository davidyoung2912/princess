import { SHORTCUTS } from '../domain/ease'
import { t, type StringKey } from '../i18n'
import { Dialog } from './Dialog'

/** The cheat sheet for the desktop keyboard shortcuts. Every one is also a visible button or link. */
export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={t('keys.title')} onClose={onClose}>
      <p className="muted">{t('keys.intro')}</p>
      <dl className="plain-dl">
        {SHORTCUTS.map((s) => (
          <div key={s.keys}><dt>{s.keys.split(' ').map((k, i) => <span key={i}>{i > 0 && ' then '}<kbd>{k}</kbd></span>)}</dt><dd>{t(`keys.${s.action}` as StringKey)}</dd></div>
        ))}
      </dl>
    </Dialog>
  )
}
