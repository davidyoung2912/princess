import { sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { FromPriceBlock, PriceState } from '../discover/parts'
import { ChoiceError } from './ChoiceError'
import { withSailing } from './changes'
import { StepSection, type StepProps } from './common'

/** Step 1: which date (BOK-01). Sailings that have left are shown but cannot be chosen, with the reason. */
export function SailingStep({ draft, update, error }: StepProps) {
  const dates = useAsync(() => api.booking.dates(), [])
  const open = dates.data?.filter((d) => d.open) ?? []
  return (
    <StepSection title={t('book.sailing.title')} intro={t('book.sailing.intro')}>
      <PriceState state={dates}>
        {dates.data && open.length === 0 && (
          <Banner kind="warning" title={t('book.sailing.none')} action={<LinkButton to="/me/demo" variant="secondary">{t('book.sailing.noneGo')}</LinkButton>}>
            <p>{t('book.sailing.noneBody')}</p>
          </Banner>
        )}
        {dates.data && (
          <fieldset>
            <legend>{t('book.sailing.legend')}</legend>
            {dates.data.map((d) => {
              const sailing = sailingById(d.id)!
              return (
                <label key={d.id} className="choice choice--top">
                  <input type="radio" name="sailing" value={d.id} checked={draft.sailingId === d.id} disabled={!d.open} onChange={() => update(withSailing(d.id))} />
                  <span>
                    {sailingRange(sailing)}
                    {d.holiday && <span className="tag">{t('discover.holiday')}</span>}
                    {d.open ? <FromPriceBlock price={d.from} /> : <small>{t('book.sailing.closed')}</small>}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}
      </PriceState>
      <ChoiceError text={error('sailingId')} />
    </StepSection>
  )
}
