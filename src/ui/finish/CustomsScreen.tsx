import { useState } from 'react'
import { asCustomsView } from '../../api/guards'
import type { CustomsView } from '../../api/finishTypes'
import { ALLOWANCE_USD, CASH_LIMIT_USD, CUSTOMS_CARRY, CUSTOMS_DECLARE, CUSTOMS_NOTE_MAX, GOODS_MAX } from '../../domain/disembark'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { ExtraError, NotAboard } from '../extras/common'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

/** Customs and immigration (DEB-04): what to carry, what to declare, and one family declaration filled in on the phone. */
export function CustomsScreen() {
  const me = usePersona()
  const copy = useSavedCopy('customs', me?.booker ?? 'none', () => api.disembark.customs(), asCustomsView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.customs')}</h1>
      <p>{t('cus.intro')}</p>
      <Saved copy={copy}>{(v) => <Customs v={v} reload={copy.retry} />}</Saved>
      <BackLink to="/home/disembark" label={t('route.disembark')} />
    </div>
  )
}

function Customs({ v, reload }: { v: CustomsView; reload: () => void }) {
  const shipTime = useShipTime()
  const [food, setFood] = useState(v.declaration?.food ?? false)
  const [cash, setCash] = useState(v.declaration?.cash ?? false)
  const [goods, setGoods] = useState(String(v.declaration?.goodsUsd ?? 0))
  const [note, setNote] = useState(v.declaration?.note ?? '')
  const goodsUsd = Number(goods)
  const bad = goods.trim() === '' || !Number.isInteger(goodsUsd) || goodsUsd < 0 || goodsUsd > GOODS_MAX
  const save = useAction(async () => { await api.disembark.saveCustoms({ food, cash, goodsUsd, note }); reload() })
  return (
    <>
      <NotAboard open={v.canEdit || v.declaration !== null} />
      <Card labelledBy="cus-carry-h">
        <h2 id="cus-carry-h" className="card__title">{t('cus.carry')}</h2>
        <ul className="plain-bullets">{CUSTOMS_CARRY.map((k) => <li key={k}>{t(`cus.carry.${k}` as StringKey)}</li>)}</ul>
      </Card>
      <Card labelledBy="cus-declare-h">
        <h2 id="cus-declare-h" className="card__title">{t('cus.declare')}</h2>
        <ul className="plain-bullets">{CUSTOMS_DECLARE.map((k) => <li key={k}>{t(`cus.declare.${k}` as StringKey, { allowance: ALLOWANCE_USD, cash: CASH_LIMIT_USD })}</li>)}</ul>
      </Card>

      <form onSubmit={(e) => { e.preventDefault(); if (!bad) void save.run() }}>
        <h2>{t('cus.form')}</h2>
        <p className="muted">{t('cus.oneForm', { count: v.people })}</p>
        <fieldset disabled={!v.canEdit}>
          <legend>{t('cus.questions')}</legend>
          <label className="choice"><input type="checkbox" checked={food} onChange={(e) => setFood(e.target.checked)} /><span>{t('cus.q.food')}</span></label>
          <label className="choice"><input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} /><span>{t('cus.q.cash', { cash: CASH_LIMIT_USD })}</span></label>
          <Field label={t('cus.q.goods')} hint={t('cus.q.goodsHint', { allowance: ALLOWANCE_USD * v.people })} type="number" inputMode="numeric" min={0} max={GOODS_MAX} value={goods} onChange={(e) => setGoods(e.target.value)} error={bad ? t('cus.err.goods') : undefined} />
          <Field label={t('cus.q.note')} maxLength={CUSTOMS_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </fieldset>
        <ExtraError error={save.error} />
        {v.canEdit && <Button type="submit" disabled={save.busy || bad}>{save.busy ? t('account.saving') : v.declaration ? t('cus.update') : t('cus.submit')}</Button>}
      </form>

      {v.declaration && v.submittedAt !== null && (
        <Banner kind="success" title={t('cus.saved', { time: shipTime(v.submittedAt) })}>
          {v.declare.length === 0 ? <p>{t('cus.nothing')}</p> : (
            <>
              <p>{t('cus.tell')}</p>
              <ul className="plain-bullets">{v.declare.map((k) => <li key={k}>{t(`cus.tell.${k}` as StringKey, { over: v.overUsd })}</li>)}</ul>
            </>
          )}
          <p>{t('cus.officer')}</p>
        </Banner>
      )}
    </>
  )
}
