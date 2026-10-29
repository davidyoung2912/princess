import { useState } from 'react'
import { resizePeople } from '../../domain/booking'
import { formatMoney } from '../../domain/pricing'
import { CATEGORIES, categoryById, type CategoryId } from '../../domain/ship'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { t } from '../../i18n'
import { PriceState } from '../discover/parts'
import { ChoiceError } from './ChoiceError'
import { withCategory } from './changes'
import { StepSection, type StepProps } from './common'

/** Step 2: room type, how many guests, and a guaranteed room or a chosen one (BOK-03). */
export function RoomStep({ draft, update, error }: StepProps) {
  const rooms = useAsync(() => api.booking.rooms(draft.sailingId), [draft.sailingId])
  const room = rooms.data?.find((r) => r.id === draft.category)
  const cap = room?.capacity ?? 4
  return (
    <StepSection title={t('book.room.title')} intro={t('book.room.intro')}>
      <PriceState state={rooms}>
        {rooms.data && (
          <fieldset>
            <legend>{t('book.room.legend')}</legend>
            {CATEGORIES.map((c) => {
              const r = rooms.data!.find((x) => x.id === c.id)!
              return (
                <label key={c.id} className="choice choice--top">
                  <input type="radio" name="category" value={c.id} checked={draft.category === c.id} onChange={() => update(withCategory(c.id, r.capacity))} />
                  <span>
                    <strong>{c.name}</strong> <span className="muted">{c.code} · {c.size} · {c.view}</span>
                    <small>{c.summary}</small>
                    <small>{t('book.room.from', { price: formatMoney(r.fare) })}{r.includes ? ` · ${t('book.room.includes')}` : ''}</small>
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}
      </PriceState>
      <ChoiceError text={error('category')} />

      <div className="field">
        <label htmlFor="guest-count">{t('book.room.guests')}</label>
        <select id="guest-count" value={draft.guests} onChange={(e) => update((d) => resizePeople(d, Number(e.target.value)))}>
          {Array.from({ length: cap }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <p className="field__hint">{draft.guests === 1 ? t('book.room.soloNote') : draft.guests > 2 ? t('book.room.extraNote') : t('book.room.guestsHint', { max: cap })}</p>
        <ChoiceError text={error('guests')} />
      </div>

      {draft.category && <CabinChoice draft={draft} update={update} error={error} />}
    </StepSection>
  )
}

/** Guaranteed room (assigned later, at no price difference) or a particular stateroom from a list with where it is and what the view is like. */
function CabinChoice({ draft, update, error }: Pick<StepProps, 'draft' | 'update' | 'error'>) {
  const [stepFree, setStepFree] = useState(false)
  const category = draft.category as CategoryId
  const cabins = useAsync(() => (draft.cabinMode === 'pick' ? api.booking.cabins(draft.sailingId, category) : Promise.resolve([])), [draft.sailingId, category, draft.cabinMode])
  const shown = (cabins.data ?? []).filter((c) => !stepFree || c.accessible)
  const decks = [...new Set(shown.map((c) => c.deck))].sort((a, b) => a - b)
  return (
    <fieldset>
      <legend>{t('book.cabin.legend')}</legend>
      <label className="choice choice--top">
        <input type="radio" name="cabin-mode" checked={draft.cabinMode === 'guaranteed'} onChange={() => update((d) => ({ ...d, cabinMode: 'guaranteed', cabinNumber: '' }))} />
        <span>{t('book.cabin.guaranteed')}<small>{t('book.cabin.guaranteedBody', { room: categoryById(category)!.name })}</small></span>
      </label>
      <label className="choice choice--top">
        <input type="radio" name="cabin-mode" checked={draft.cabinMode === 'pick'} onChange={() => update((d) => ({ ...d, cabinMode: 'pick' }))} />
        <span>{t('book.cabin.pick')}<small>{t('book.cabin.pickBody')}</small></span>
      </label>
      {draft.cabinMode === 'pick' && (
        <div>
          <label className="choice">
            <input type="checkbox" checked={stepFree} onChange={(e) => setStepFree(e.target.checked)} />
            <span>{t('book.cabin.stepFree')}</span>
          </label>
          <PriceState state={cabins}>
            {decks.length === 0 && <p className="muted">{t('book.cabin.none')}</p>}
            {decks.map((deck) => (
              <fieldset key={deck}>
                <legend>{t('book.cabin.deck', { deck })}</legend>
                {shown.filter((c) => c.deck === deck).map((c) => (
                  <label key={c.number} className="choice choice--top">
                    <input type="radio" name="cabin" value={c.number} checked={draft.cabinNumber === c.number} disabled={!c.available} onChange={() => update((d) => ({ ...d, cabinNumber: c.number }))} />
                    <span>
                      {t('book.cabin.number', { number: c.number })} <span className="muted">{t(`book.cabin.position.${c.position}`)}, {t(`book.cabin.side.${c.side}`)}</span>
                      <small>{c.available ? c.notes.join('. ') : t('book.cabin.taken')}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </PriceState>
          <p className="muted">{t('book.cabin.sampleNote')}</p>
        </div>
      )}
      <ChoiceError text={error('cabinNumber')} />
    </fieldset>
  )
}
