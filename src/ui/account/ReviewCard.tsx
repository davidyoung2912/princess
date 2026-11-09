import { useEffect, useState } from 'react'
import { auth } from '../../runtime'
import type { ReviewDecision, ReviewItem } from '../../auth/provider'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

const day = (epoch: number): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(epoch)

/** For Guest Services: accounts flagged as a possible duplicate, each settled by a person as different people or the same guest (IDN-03). Nothing is merged here. */
export function ReviewCard() {
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    auth.account!.listReviews().then((list) => { if (live) setItems(list) }, () => { if (live) setLoadFailed(true) })
    return () => { live = false }
  }, [attempt])
  const retry = () => { setLoadFailed(false); setAttempt((n) => n + 1) }

  const settle = async (item: ReviewItem, decision: ReviewDecision) => {
    setSaveFailed(false)
    setDone(null)
    setBusy(item.id)
    try {
      await auth.account!.resolveReview(item.id, decision)
      setItems((list) => list?.filter((x) => x.id !== item.id) ?? null)
      setDone(t(decision === 'same' ? 'review.doneSame' : 'review.doneDifferent', { number: item.accountNumber }))
    } catch { setSaveFailed(true) } finally { setBusy(null) }
  }

  return (
    <Card>
      <h2>{t('review.title')}</h2>
      <p className="muted">{t('review.body')}</p>
      {loadFailed && (
        <>
          <p role="alert">{t('review.failed')}</p>
          <p><Button variant="secondary" onClick={retry}>{t('review.retry')}</Button></p>
        </>
      )}
      {!loadFailed && items === null && <p role="status">{t('review.loading')}</p>}
      {saveFailed && <p role="alert">{t('review.saveFailed')}</p>}
      {done && <p role="status">{done}</p>}
      {items?.length === 0 && <p>{t('review.none')}</p>}
      {items && items.length > 0 && (
        <ul className="plain-list">
          {items.map((i) => (
            <li key={i.id}>
              <h3>{i.firstName} {i.lastName}</h3>
              <p>{t('review.account', { number: i.accountNumber, date: day(i.createdAt) })} · {t('review.dob', { dob: i.dob })}</p>
              {i.matches.length === 0
                ? <p className="muted">{t('review.noMatch')}</p>
                : (
                  <>
                    <p className="muted">{t('review.matches')}</p>
                    <ul>
                      {i.matches.map((m) => <li key={m.id}>{t('review.account', { number: m.accountNumber, date: day(m.createdAt) })}</li>)}
                    </ul>
                  </>
                )}
              <p>
                <Button variant="secondary" onClick={() => { if (busy === null) void settle(i, 'different') }}>{t('review.different', { number: i.accountNumber })}</Button>
                {' '}
                <Button variant="secondary" onClick={() => { if (busy === null) void settle(i, 'same') }}>{t('review.same', { number: i.accountNumber })}</Button>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{t('review.footnote')}</p>
    </Card>
  )
}
