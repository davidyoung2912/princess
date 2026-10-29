import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { asBoardingView } from '../../api/guards'
import type { BoardingView, GuestPass } from '../../api/types'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { formatDate, formatTime } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Printer } from '../icons'
import { SyncChip } from '../SyncChip'
import { LoadError } from '../discover/parts'
import { ActionError } from '../account/parts'
import { FailsafeCard, PassFace } from './parts'

/** The boarding pass (CHK-04, CHK-14): large, high-contrast, kept on the phone, with a bright full-screen view, wallet, print, and a plan for a dead phone. */
export function PassScreen() {
  const me = usePersona()
  const pass = useSavedCopy('pass', me?.booker ?? 'none', () => api.boarding.pass(), asBoardingView, [me?.id])
  const now = useNow()
  return (
    <div className="page">
      <h1>{t('route.boardingPass')}</h1>
      {pass.data ? (
        <>
          {pass.at !== null && <SyncChip updated={new Date(pass.at)} now={new Date(now)} state={pass.fromCopy ? 'offline' : 'live'} timeZone="America/New_York" />}
          <PassBody pass={pass.data} offline={pass.fromCopy} reload={pass.retry} />
        </>
      ) : pass.status === 'error' ? <LoadError retry={pass.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>}
    </div>
  )
}

export function PassBody({ pass, offline, reload, signedIn = true }: { pass: BoardingView; offline: boolean; reload: () => void; signedIn?: boolean }) {
  const [bright, setBright] = useState<GuestPass | null>(null)
  const wallet = useAction(async () => { await api.boarding.addToWallet(); reload() })
  return (
    <>
      {offline && <Banner kind="offline" title={t('pass.offline')}><p>{t('pass.offlineBody')}</p></Banner>}
      {pass.terminal.changedFrom && <Banner kind="warning" title={t('pass.terminalChanged', { from: pass.terminal.changedFrom, to: pass.terminal.name })}><p>{t('pass.terminalChangedBody')}</p></Banner>}
      {!pass.checkinDone && (
        <Banner kind="warning" title={t('pass.notReady')} action={signedIn ? <LinkButton to="/home/check-in" variant="secondary">{t('route.checkin')}</LinkButton> : undefined}>
          <p>{t('pass.notReadyBody')} <Link to="/home/check-in/terminal">{t('route.terminalCheckin')}</Link></p>
        </Banner>
      )}
      <p className="muted">{t('trip.booking', { number: pass.number })} · {formatDate(pass.departure)}</p>
      <ul className="pass-list">
        {pass.passes.map((p) => (
          <li key={p.id} className="pass">
            <PassFace pass={pass} p={p} />
            {p.ready && <Button variant="secondary" className="no-print" onClick={() => setBright(p)}>{t('pass.bright', { name: p.name })}</Button>}
          </li>
        ))}
      </ul>
      {pass.arrival && <p>{t('pass.arrive', { start: formatTime(pass.arrival.start), end: formatTime(pass.arrival.end) })} · {t('pass.terminal', { terminal: pass.terminal.name })}</p>}

      {pass.checkinDone && signedIn && (
        <section className="no-print" aria-labelledby="keep-h">
          <h2 id="keep-h">{t('pass.keep')}</h2>
          <div className="button-row">
            {pass.inWallet ? <p role="status"><strong>{t('pass.inWallet')}</strong> {t('pass.inWalletBody')}</p> : <Button onClick={() => void wallet.run()} disabled={wallet.busy || offline}>{t('pass.addWallet')}</Button>}
            <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('pass.print')}</Button>
          </div>
          <ActionError error={wallet.error} />
          <p className="muted">{t('pass.walletNote')}</p>
        </section>
      )}
      {pass.checkinDone && !signedIn && <div className="button-row no-print"><Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('pass.print')}</Button></div>}

      <FailsafeCard number={GUEST_SERVICES_NUMBER} />
      {signedIn && <Card info><p>{t('pass.next')} <Link to="/home/embarkation">{t('route.embarkation')}</Link></p></Card>}
      {bright && <BrightView pass={pass} p={bright} onClose={() => setBright(null)} />}
    </>
  )
}

/** A full-screen white pass with the biggest possible code. Browsers cannot raise screen brightness, so this keeps the screen awake where it can and asks the guest to turn brightness up. */
function BrightView({ pass, p, onClose }: { pass: BoardingView; p: GuestPass; onClose: () => void }) {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const wake = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } }).wakeLock
    void wake?.request('screen').then((l) => { lock = l }).catch(() => undefined)
    return () => { void lock?.release().catch(() => undefined) }
  }, [])
  return (
    <Dialog title={t('pass.brightTitle', { name: p.name })} onClose={onClose}>
      <div className="pass pass--bright"><PassFace pass={pass} p={p} big /></div>
      <p className="muted">{t('pass.brightNote')}</p>
    </Dialog>
  )
}
