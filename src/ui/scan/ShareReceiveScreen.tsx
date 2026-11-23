import { useLocation, useNavigate } from 'react-router'
import { t } from '../../i18n'
import { ReceiveSheet } from './ReceiveSheet'

/** The page a hand-over address opens (a code scanned with the phone's own camera, or a copied link). Signed-out guests sign in first and land back here, because the address is kept. */
export function ShareReceiveScreen() {
  const { pathname, search } = useLocation()
  const go = useNavigate()
  return (
    <main className="stack">
      <h1>{t('route.handOver')}</h1>
      <ReceiveSheet path={`${pathname}${search}`} onDone={() => go('/')} />
    </main>
  )
}
