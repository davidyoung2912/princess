import { useSyncExternalStore } from 'react'
import { auth, signOutSaving } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

/** The account page, reached from the logo in the top bar: who is signed in, and how to sign out. More will be added here. */
export function AccountScreen() {
  const user = useSyncExternalStore(auth.subscribe, auth.current, auth.current)?.user
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  return (
    <div className="page">
      <Card>
        <p className="muted">{t('account.signedInAs')}</p>
        {name && <p className="me-name">{name}</p>}
        {user?.email && <p>{t('account.email')}: {user.email}</p>}
        {user?.accountNumber && <p>{t('account.number')}: {user.accountNumber}</p>}
        {user?.isDemo && <p className="muted">{t('account.demo')}</p>}
      </Card>
      <p><Button variant="secondary" onClick={() => void signOutSaving()}>{t('signin.signOut')}</Button></p>
    </div>
  )
}
