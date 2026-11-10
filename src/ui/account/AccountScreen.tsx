import { useState, useSyncExternalStore } from 'react'
import { auth, signOutEverywhereSaving, signOutSaving } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { DevicesCard } from './DevicesCard'
import { ReviewCard } from './ReviewCard'
import { RoomsStaffCard } from './RoomsStaffCard'

/** The account page, reached from the logo in the top bar: who is signed in, and how to sign out. More will be added here. */
export function AccountScreen() {
  const user = useSyncExternalStore(auth.subscribe, auth.current, auth.current)?.user
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const [asking, setAsking] = useState(false)
  const [failed, setFailed] = useState(false)
  const everywhere = async () => {
    setFailed(false)
    try { await signOutEverywhereSaving() } catch { setFailed(true) }
  }
  return (
    <div className="page">
      <Card>
        <p className="muted">{t('account.signedInAs')}</p>
        {name && <p className="me-name">{name}</p>}
        {user?.email && <p>{t('account.email')}: {user.email}</p>}
        {user?.accountNumber && <p>{t('account.number')}: {user.accountNumber}</p>}
        {user?.needsReview && <p role="status">{t('account.review')}</p>}
        {user?.isDemo && <p className="muted">{t('account.demo')}</p>}
      </Card>
      <p><Button variant="secondary" onClick={() => void signOutSaving()}>{t('signin.signOut')}</Button></p>
      {auth.account && !user?.isDemo && <DevicesCard />}
      {auth.account && user?.role === 'admin' && <ReviewCard />}
      {auth.account && user?.role === 'admin' && <RoomsStaffCard />}
      {auth.account && !user?.isDemo && (
        <Card>
          <h2>{t('signin.signOutEverywhere')}</h2>
          <p className="muted">{t('signin.signOutEverywhereBody')}</p>
          {failed && <p role="alert">{t('signin.signOutEverywhereFailed')}</p>}
          {asking
            ? <p><Button variant="secondary" onClick={() => void everywhere()}>{t('signin.signOutEverywhereConfirm')}</Button></p>
            : <p><Button variant="secondary" onClick={() => setAsking(true)}>{t('signin.signOutEverywhere')}</Button></p>}
        </Card>
      )}
    </div>
  )
}
