import { useEffect, useState } from 'react'
import { auth } from '../../runtime'
import type { DeviceSession } from '../../auth/provider'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Banner } from '../Banner'
import { markSeen, newDevices, readSeen } from '../../auth/newDevices'

const when = (epoch: number): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(epoch)

/** The devices signed in to this account, each with a sign-out of its own (IDN-01). */
export function DevicesCard() {
  const [devices, setDevices] = useState<DeviceSession[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [outFailed, setOutFailed] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [seen, setSeen] = useState<string[] | null>(() => readSeen())

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    auth.account!.listDevices().then((list) => {
      if (!live) return
      setDevices(list)
      // The first look sets the baseline: what was already signed in is not new.
      if (readSeen() === null) { markSeen(list.map((x) => x.id)); setSeen(list.map((x) => x.id)) }
    }, () => { if (live) setLoadFailed(true) })
    return () => { live = false }
  }, [attempt])
  const retry = () => { setLoadFailed(false); setAttempt((n) => n + 1) }

  const fresh = devices ? newDevices(devices, seen) : []
  const itWasMe = () => { markSeen(fresh.map((x) => x.id)); setSeen(readSeen()) }

  const signOut = async (d: DeviceSession) => {
    setOutFailed(false)
    setDone(null)
    setBusy(d.id)
    try {
      await auth.account!.signOutDevice(d.id)
      setDevices((list) => list?.filter((x) => x.id !== d.id) ?? null)
      setDone(d.device)
    } catch { setOutFailed(true) } finally { setBusy(null) }
  }

  return (
    <Card>
      <h2>{t('devices.title')}</h2>
      <p className="muted">{t('devices.body')}</p>
      {loadFailed && (
        <>
          <p role="alert">{t('devices.failed')}</p>
          <p><Button variant="secondary" onClick={retry}>{t('devices.retry')}</Button></p>
        </>
      )}
      {!loadFailed && devices === null && <p role="status">{t('devices.loading')}</p>}
      {outFailed && <p role="alert">{t('devices.signOutFailed')}</p>}
      {done && <p role="status">{t('devices.signedOut', { device: done })}</p>}
      {fresh.length > 0 && (
        <Banner kind="warning" title={t('devices.new.title')} action={<Button variant="secondary" onClick={itWasMe}>{t('devices.new.itWasMe')}</Button>}>
          <p>{t('devices.new.body', { devices: fresh.map((x) => x.device).join(', '), date: when(Math.max(...fresh.map((x) => x.signedInAt))) })}</p>
        </Banner>
      )}
      {devices && (
        <ul className="plain-list">
          {devices.map((d) => (
            <li key={d.id}>
              <p><strong>{d.device}</strong>{d.current && <> · {t('devices.thisDevice')}</>}</p>
              <p className="muted">{t('devices.signedIn', { date: when(d.signedInAt) })} · {t('devices.lastActive', { date: when(d.lastActiveAt) })}</p>
              {!d.current && (
                <p><Button variant="secondary" onClick={() => { if (busy === null) void signOut(d) }}>{t('devices.signOut', { device: d.device })}</Button></p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
