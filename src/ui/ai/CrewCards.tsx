import { useState } from 'react'
import { CREW_CARDS, CREW_DETAIL_HINT, CREW_DETAIL_MAX, crewCard, type CrewCardKind } from '../../domain/crewCards'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/**
 * "Show this to crew" (phase 6): a large-text English card to hold up to a waiter, a steward or a gangway officer. The guest chooses the card and may type a few words;
 * nothing is read from their records and nothing is sent anywhere.
 */
export function CrewCards() {
  const [kind, setKind] = useState<CrewCardKind>('dietary')
  const [detail, setDetail] = useState('')
  const [shown, setShown] = useState(false)
  if (shown) {
    const c = crewCard(kind, detail)
    return (
      <Card labelledBy="crew-card-h">
        <div className="crew-card" lang="en">
          <h2 id="crew-card-h" className="crew-card__head">{c.headline}</h2>
          {c.detail && <p className="crew-card__detail">{c.detail}</p>}
          <p className="crew-card__ask">{c.ask}</p>
        </div>
        <Button variant="secondary" onClick={() => setShown(false)}>{t('crew.back')}</Button>
      </Card>
    )
  }
  return (
    <Card labelledBy="crew-h">
      <h2 id="crew-h" className="card__title">{t('crew.title')}</h2>
      <p>{t('crew.body')}</p>
      <fieldset className="plain-fieldset">
        <legend>{t('crew.card.label')}</legend>
        {CREW_CARDS.map((k) => <label key={k} className="choice"><input type="radio" name="crew-kind" checked={kind === k} onChange={() => setKind(k)} /><span>{t(`crew.card.${k}` as StringKey)}</span></label>)}
      </fieldset>
      <Field label={t('crew.detail')} hint={CREW_DETAIL_HINT[kind]} value={detail} maxLength={CREW_DETAIL_MAX} onChange={(e) => setDetail(e.target.value)} />
      <Button onClick={() => setShown(true)}>{t('crew.show')}</Button>
    </Card>
  )
}
