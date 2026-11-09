import type { AssistanceView } from '../../api/types'
import { activeShare, previewFor, RECIPIENTS, revoke, share, type Recipient } from '../../domain/passport'
import { useNow } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { useShipTime } from '../onboard/shipTime'
import { firstName } from './people'

/** The accessibility passport (QOL-20): see what each part of the trip would get before sharing, take the sharing back at any time, and see when it was acknowledged. */
export function PassportCard({ view }: { view: AssistanceView }) {
  const { state, update } = usePilot()
  const now = useNow()
  const when = useShipTime()
  if (view.requests.length === 0) return null
  const set = (change: (list: typeof state.passport) => typeof state.passport) => update((s) => ({ ...s, passport: change(s.passport) }))
  return (
    <section aria-labelledby="pp-h">
      <h2 id="pp-h">{th('passport.title')}</h2>
      <p>{t('passport.intro')}</p>
      <ul className="card-grid">
        {RECIPIENTS.map((r: Recipient) => {
          const preview = previewFor(r, view.requests)
          const on = activeShare(state.passport, r)
          return (
            <li key={r}>
              <Card>
                <h3 className="card__title">{th(`passport.to.${r}` as StringKey)}</h3>
                {preview.length === 0 ? <p className="muted">{t('passport.nothing')}</p> : (
                  <ul className="plain-bullets" aria-label={t('passport.sees', { who: t(`passport.to.${r}` as StringKey) })}>
                    {preview.map((p) => <li key={p.id}>{t(`assist.kind.${p.kind}` as StringKey)}, {firstName(p.guest)}</li>)}
                  </ul>
                )}
                <p className="muted">{t('passport.noMedical')}</p>
                {on ? (
                  <>
                    <p role="status">{t('passport.shared', { time: when(on.sharedAt) })} {on.ackAt === null ? t('passport.noAck') : t('passport.acked', { time: when(on.ackAt) })}</p>
                    <Button variant="secondary" onClick={() => set((l) => revoke(l, r, now))}>{t('passport.revoke')}<span className="visually-hidden"> {t(`passport.to.${r}` as StringKey)}</span></Button>
                  </>
                ) : (
                  <Button disabled={preview.length === 0} onClick={() => set((l) => share(l, r, now))}>{t('passport.share')}<span className="visually-hidden"> {t(`passport.to.${r}` as StringKey)}</span></Button>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
