import { MEMBER_PERCENT } from '../../domain/ahead'
import { formatMoney } from '../../domain/pricing'
import type { QuoteView } from '../../api/types'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Field } from '../Field'
import type { StepProps } from './common'

/** Captain's Circle number and future cruise credit at booking (BOK-11, BOK-12). The discount and credit show in the price once a valid number or the credit is chosen. */
export function PerksPanel({ draft, update, quote }: Pick<StepProps, 'draft' | 'update'> & { quote: QuoteView | null }) {
  const mine = useMine(() => api.ahead.perks.mine())
  const perks = quote?.perks
  const typed = draft.loyaltyNumber.length > 0
  return (
    <section aria-labelledby="perks-h">
      <h3 id="perks-h">{t('book.perks.title')}</h3>
      <p>{t('book.perks.intro')}</p>
      <Field
        label={t('book.perks.number')}
        hint={t('book.perks.numberHint')}
        value={draft.loyaltyNumber}
        maxLength={9}
        autoComplete="off"
        error={typed && perks && !perks.numberOk ? t('book.perks.bad') : undefined}
        onChange={(e) => update((d) => ({ ...d, loyaltyNumber: e.target.value.trim().toUpperCase() }))}
      />
      {mine.data && mine.data.number !== draft.loyaltyNumber && (
        <p><Button variant="tertiary" onClick={() => update((d) => ({ ...d, loyaltyNumber: mine.data!.number }))}>{t('book.perks.useMine', { number: mine.data.number })}</Button></p>
      )}
      {perks?.numberOk && <p role="status">{t('book.perks.applied', { tier: t(`me.tier.${perks.tier}` as StringKey), percent: MEMBER_PERCENT[perks.tier], amount: formatMoney(perks.discount) })}</p>}
      {mine.data && mine.data.creditLeft > 0 && (
        <label className="choice choice--top">
          <input type="checkbox" checked={draft.useCredit} onChange={(e) => update((d) => ({ ...d, useCredit: e.target.checked }))} />
          <span>{t('book.perks.credit', { amount: formatMoney(mine.data.creditLeft) })}<small>{t('book.perks.creditBody')}</small></span>
        </label>
      )}
      {perks && perks.credit > 0 && <p role="status">{t('book.perks.creditApplied', { amount: formatMoney(perks.credit) })}</p>}
    </section>
  )
}
