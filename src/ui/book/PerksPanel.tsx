import { MEMBER_PERCENT } from '../../domain/ahead'
import { creditLine } from '../../domain/creditLines'
import { formatMoney } from '../../domain/money'
import type { QuoteView } from '../../api/types'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
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
      <h3 id="perks-h">{th('book.perks.title')}</h3>
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
      {mine.data && creditLine(mine.data.creditLeft, perks?.credit ?? 0, draft.useCredit) && <CreditDetail line={creditLine(mine.data.creditLeft, perks?.credit ?? 0, draft.useCredit)!} />}
    </section>
  )
}

/** Where a credit comes from, how much there is, whether it can be used and what is left after (BOK-12). An unusable credit says why. */
function CreditDetail({ line }: { line: NonNullable<ReturnType<typeof creditLine>> }) {
  return (
    <dl className="facts" aria-label={t('book.credit.label')}>
      <div><dt>{t('book.credit.source')}</dt><dd>{t(`book.credit.src.${line.source}` as StringKey)}</dd></div>
      <div><dt>{t('book.credit.amount')}</dt><dd>{formatMoney(line.amount)}</dd></div>
      <div><dt>{t('book.credit.used')}</dt><dd>{formatMoney(line.applied)}</dd></div>
      <div><dt>{t('book.credit.left')}</dt><dd>{formatMoney(line.residual)}</dd></div>
      {line.why !== 'none' && <div><dt>{t('book.credit.why')}</dt><dd>{t(`book.credit.why.${line.why}` as StringKey)}</dd></div>}
    </dl>
  )
}
