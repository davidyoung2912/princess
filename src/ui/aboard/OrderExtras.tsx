import { useState, type FormEvent } from 'react'
import { canDeliver, canGift, deliveryOf, deliveryWindow, giftProblem, GIFT_MESSAGE_MAX, GIFT_NAME_MAX, type Gift, type GiftHow } from '../../domain/shopExtras'
import { useShopExtras } from '../../hooks/useShopExtras'
import { useNow } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Field, TextArea } from '../Field'

/** Under an ordered shop line: bring it to the cabin (SHP-05), or, for a gift card, say who it is for (POS-13). Kept on this device. */
export function OrderExtras({ itemId, lineId, canEdit }: { itemId: string; lineId: string; canEdit: boolean }) {
  const { extras, deliver, gift } = useShopExtras()
  const now = useNow()
  if (canDeliver(itemId)) {
    const toCabin = deliveryOf(extras, lineId) === 'cabin'
    const hour = new Date(now).getUTCHours()
    return (
      <div>
        <label className="choice">
          <input type="checkbox" checked={toCabin} disabled={!canEdit} onChange={(e) => deliver(lineId, e.target.checked ? 'cabin' : 'pickup')} />
          <span>{t('shop.toCabin')}</span>
        </label>
        <p className="muted">{toCabin ? t(`shop.cabin.${deliveryWindow(hour)}` as StringKey) : t('shop.pickupNote')}</p>
      </div>
    )
  }
  if (canGift(itemId)) return <GiftForm lineId={lineId} canEdit={canEdit} given={extras.gifts[lineId] ?? null} save={(g) => gift(lineId, g)} />
  return null
}

function GiftForm({ lineId, canEdit, given, save }: { lineId: string; canEdit: boolean; given: Gift | null; save: (g: Gift | null) => void }) {
  const [open, setOpen] = useState(false)
  const [g, setG] = useState<Gift>(given ?? { to: '', how: 'email', where: '', message: '' })
  const [tried, setTried] = useState(false)
  const problem = giftProblem(g)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem) return
    save({ ...g, to: g.to.trim(), where: g.where.trim() })
    setOpen(false)
  }
  if (!open) {
    return (
      <div>
        {given && <p>{t('shop.giftFor', { name: given.to, how: t(`shop.how.${given.how}` as StringKey), where: given.where })}</p>}
        {canEdit && (
          <div className="button-row">
            <Button variant="tertiary" onClick={() => setOpen(true)}>{given ? t('shop.giftEdit') : t('shop.giftAdd')}</Button>
            {given && <Button variant="tertiary" onClick={() => save(null)}>{t('shop.giftClear')}</Button>}
          </div>
        )}
        {!given && <p className="muted">{t('shop.giftNone')}</p>}
      </div>
    )
  }
  return (
    <form onSubmit={submit} aria-label={t('shop.giftAdd')} id={`gift-${lineId}`}>
      <Field label={t('shop.giftTo')} maxLength={GIFT_NAME_MAX} value={g.to} onChange={(e) => setG({ ...g, to: e.target.value })} error={tried && (problem === 'noName' || problem === 'badName') ? t(`shop.err.${problem}` as StringKey) : undefined} />
      <fieldset className="plain-fieldset">
        <legend>{t('shop.giftHow')}</legend>
        {(['email', 'cabin'] as GiftHow[]).map((h) => (
          <label key={h} className="choice"><input type="radio" name={`how-${lineId}`} checked={g.how === h} onChange={() => setG({ ...g, how: h, where: '' })} /><span>{t(`shop.how.${h}` as StringKey)}</span></label>
        ))}
      </fieldset>
      <Field label={g.how === 'email' ? t('shop.giftEmail') : t('shop.giftCabin')} type={g.how === 'email' ? 'email' : 'text'} inputMode={g.how === 'email' ? 'email' : 'numeric'} value={g.where} onChange={(e) => setG({ ...g, where: e.target.value })} error={tried && (problem === 'badEmail' || problem === 'badCabin') ? t(`shop.err.${problem}` as StringKey) : undefined} />
      <TextArea label={t('shop.giftMessage')} hint={t('shop.giftMessageHint', { max: GIFT_MESSAGE_MAX })} value={g.message} onChange={(e) => setG({ ...g, message: e.target.value })} maxLength={GIFT_MESSAGE_MAX} />
      <div className="button-row">
        <Button type="submit">{t('shop.giftSave')}</Button>
        <Button variant="tertiary" onClick={() => setOpen(false)}>{t('shop.giftCancel')}</Button>
      </div>
    </form>
  )
}
