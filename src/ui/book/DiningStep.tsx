import { DIETARY, type DietaryId } from '../../domain/account'
import { DINING_CHOICES, OCCASIONS, type GuestDraft, type Occasion } from '../../domain/booking'
import { t, type StringKey } from '../../i18n'
import { TextArea } from '../Field'
import { ChoiceError } from './ChoiceError'
import { StepSection, type StepProps } from './common'

const toggle = <T,>(list: readonly T[], item: T, on: boolean): T[] => (on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item))

/** Step 5: dining time, special occasions, and each guest's dietary needs and allergies (BOK-18). Every guest gives an explicit answer, so a missing allergy is never just an unfilled box. */
export function DiningStep({ draft, update, error }: StepProps) {
  const setGuest = (i: number, patch: Partial<GuestDraft>) => update((d) => ({ ...d, people: d.people.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  return (
    <StepSection title={t('book.dining.title')} intro={t('book.dining.intro')}>
      <fieldset>
        <legend>{t('book.dining.legend')}</legend>
        {DINING_CHOICES.map((c) => (
          <label key={c} className="choice choice--top">
            <input type="radio" name="dining" value={c} checked={draft.dining === c} onChange={() => update((d) => ({ ...d, dining: c }))} />
            <span>{t(`book.dining.${c}` as StringKey)}<small>{t(`book.dining.${c}.body` as StringKey)}</small></span>
          </label>
        ))}
        <ChoiceError text={error('dining')} />
      </fieldset>

      <div className="field">
        <label htmlFor="occasion">{t('book.occasion.label')}</label>
        <p className="field__hint">{t('book.occasion.hint')}</p>
        <select id="occasion" value={draft.occasion} onChange={(e) => update((d) => ({ ...d, occasion: e.target.value as Occasion }))}>
          {OCCASIONS.map((o) => <option key={o} value={o}>{t(`book.occasion.${o}` as StringKey)}</option>)}
        </select>
      </div>

      <h3>{t('book.diet.title')}</h3>
      <p>{t('book.diet.intro')}</p>
      {draft.people.map((g, i) => {
        const name = g.firstName.trim() || t('book.guests.guestN', { n: i + 1 })
        return (
          <fieldset key={i}>
            <legend>{name}</legend>
            <label className="choice">
              <input type="radio" name={`diet-${i}`} checked={g.dietaryStatus === 'none'} onChange={() => setGuest(i, { dietaryStatus: 'none', dietary: [], allergyNote: '' })} />
              <span>{t('book.diet.none')}</span>
            </label>
            <label className="choice">
              <input type="radio" name={`diet-${i}`} checked={g.dietaryStatus === 'some'} onChange={() => setGuest(i, { dietaryStatus: 'some' })} />
              <span>{t('book.diet.some')}</span>
            </label>
            <ChoiceError text={error(`people.${i}.dietaryStatus`)} />
            {g.dietaryStatus === 'some' && (
              <div>
                {DIETARY.map((x: DietaryId) => (
                  <label key={x} className="choice">
                    <input type="checkbox" checked={g.dietary.includes(x)} onChange={(e) => setGuest(i, { dietary: toggle(g.dietary, x, e.target.checked) })} />
                    <span>{t(`book.diet.${x}` as StringKey)}</span>
                  </label>
                ))}
                <TextArea label={t('book.diet.note')} hint={t('book.diet.noteHint')} value={g.allergyNote} maxLength={300} onChange={(e) => setGuest(i, { allergyNote: e.target.value })} />
                <ChoiceError text={error(`people.${i}.dietary`)} />
              </div>
            )}
          </fieldset>
        )
      })}
      <p className="muted">{t('book.diet.safety')}</p>
    </StepSection>
  )
}
