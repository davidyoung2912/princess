import { useState } from 'react'
import { addItem, addParty, balances, FAMILY_PROBLEM_KEY, ITEM_PROBLEM_KEY, formatCents, markSettled, removeItem, removeParty, settleUp, SPLIT_KINDS, totalShared, type SplitKind, type SplitMode, type SplitParty } from '../../domain/ledgerSplit'

import { newPortId, usePort } from '../../hooks/usePort'
import { useNow } from '../../hooks/useDemo'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'
import { partyPeople } from '../../account/context'

/** The split ledger (XG-03, S6A-06): what each family paid for shared things, and a fair way to settle up. It never moves money. */
export function SplitScreen() {
  const { state, update, me } = usePort()
  const now = useNow()
  const split = state.split
  // Until the first change is saved, the person's own family is shown as the starting point.
  const own: SplitParty[] = me ? [{ id: me.booker, name: t('split.myFamily', { name: me.name.split(' ').slice(-1)[0] }), people: partyPeople(me.id).length }] : []
  const parties = split.parties.length > 0 ? split.parties : own
  const working = { ...split, parties }
  const names = Object.fromEntries(parties.map((p) => [p.id, p.name]))
  const bal = balances(working)
  const transfers = settleUp(working)

  const [fam, setFam] = useState('')
  const [people, setPeople] = useState('2')
  const [famProblem, setFamProblem] = useState<StringKey | null>(null)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<SplitKind>('taxi')
  const [paidBy, setPaidBy] = useState('')
  const [among, setAmong] = useState<string[]>([])
  const [mode, setMode] = useState<SplitMode>('equal')
  const [itemProblem, setItemProblem] = useState<StringKey | null>(null)
  const payer = parties.some((p) => p.id === paidBy) ? paidBy : (parties[0]?.id ?? '')

  const commit = (next: typeof split) => update((s) => ({ ...s, split: next }))

  const addFamily = () => {
    const r = addParty(working, fam, Number(people), newPortId())
    if (r.problem) return setFamProblem(FAMILY_PROBLEM_KEY[r.problem])
    setFamProblem(null)
    commit(r.state)
    setFam('')
  }
  const addShared = () => {
    const r = addItem(working, { title, kind, amount, paidBy: payer, among, mode, date: null }, now, newPortId())
    if (r.problem) return setItemProblem(ITEM_PROBLEM_KEY[r.problem])
    setItemProblem(null)
    commit(r.state)
    setTitle('')
    setAmount('')
  }

  return (
    <div className="page">
      <h1>{th('route.split')}</h1>
      <p>{t('split.intro')}</p>
      <Banner kind="info" title={t('split.noMoney')}><p>{t('split.noMoneyBody')}</p></Banner>

      <Card labelledBy="split-fam">
        <h2 id="split-fam" className="card__title">{th('split.families')}</h2>
        <ul className="plain-bullets">{parties.map((p) => (
          <li key={p.id}>{t('split.family', { name: p.name, people: p.people })}{' '}
            {split.parties.some((x) => x.id === p.id) && <Button variant="tertiary" onClick={() => commit(removeParty(working, p.id))}>{t('split.removeFamily', { name: p.name })}</Button>}
          </li>
        ))}</ul>
        <p className="muted">{t('split.removeNote')}</p>
        <form onSubmit={(e) => { e.preventDefault(); addFamily() }}>
          <Field label={t('split.famName')} value={fam} maxLength={40} onChange={(e) => setFam(e.target.value)} />
          <Field label={t('split.famPeople')} type="number" min={1} max={12} value={people} onChange={(e) => setPeople(e.target.value)} />
          {famProblem && <p className="field__error" role="alert">{t(famProblem)}</p>}
          <Button type="submit" variant="secondary">{t('split.addFamily')}</Button>
        </form>
      </Card>

      <Card labelledBy="split-add">
        <h2 id="split-add" className="card__title">{th('split.add')}</h2>
        {parties.length < 2 ? <p>{t('split.needTwo')}</p> : (
          <form onSubmit={(e) => { e.preventDefault(); addShared() }}>
            <Field label={t('split.what')} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            <Field label={t('split.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <label className="field"><span>{t('split.kind')}</span>
              <select className="field__input" value={kind} onChange={(e) => setKind(e.target.value as SplitKind)}>{SPLIT_KINDS.map((k) => <option key={k} value={k}>{t(`split.kind.${k}` as StringKey)}</option>)}</select>
            </label>
            <label className="field"><span>{t('split.paidBy')}</span>
              <select className="field__input" value={payer} onChange={(e) => setPaidBy(e.target.value)}>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <fieldset>
              <legend>{t('split.among')}</legend>
              {parties.map((p) => <label key={p.id} className="choice"><input type="checkbox" checked={among.includes(p.id)} onChange={(e) => setAmong(e.target.checked ? [...among, p.id] : among.filter((x) => x !== p.id))} /><span>{p.name}</span></label>)}
            </fieldset>
            <fieldset>
              <legend>{t('split.how')}</legend>
              <label className="choice"><input type="radio" name="split-mode" checked={mode === 'equal'} onChange={() => setMode('equal')} /><span>{t('split.how.equal')}</span></label>
              <label className="choice"><input type="radio" name="split-mode" checked={mode === 'byPeople'} onChange={() => setMode('byPeople')} /><span>{t('split.how.byPeople')}</span></label>
            </fieldset>
            {itemProblem && <p className="field__error" role="alert">{t(itemProblem)}</p>}
            <Button type="submit">{t('split.save')}</Button>
          </form>
        )}
      </Card>

      <section aria-labelledby="split-list">
        <h2 id="split-list">{th('split.items')}</h2>
        {split.items.length === 0 ? <p>{t('split.noItems')}</p> : (
          <ul className="card-grid">
            {split.items.map((x) => (
              <li key={x.id} className="card">
                <h3 className="card__title">{x.title}</h3>
                <p>{t('split.itemLine', { amount: formatCents(x.cents), who: names[x.paidBy] ?? '', kind: t(`split.kind.${x.kind}` as StringKey) })}</p>
                <p className="muted">{t('split.itemAmong', { names: x.among.map((id) => names[id] ?? '').join(', ') })}</p>
                <Button variant="tertiary" onClick={() => commit(removeItem(working, x.id))}>{t('split.remove', { title: x.title })}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card labelledBy="split-settle">
        <h2 id="split-settle" className="card__title">{th('split.settle')}</h2>
        <p className="muted">{t('split.total', { amount: formatCents(totalShared(working)) })}</p>
        <ul className="plain-bullets">{parties.map((p) => <li key={p.id}>{bal[p.id] === 0 ? t('split.even', { name: p.name }) : bal[p.id] > 0 ? t('split.owed', { name: p.name, amount: formatCents(bal[p.id]) }) : t('split.owes', { name: p.name, amount: formatCents(-bal[p.id]) })}</li>)}</ul>
        {transfers.length === 0 ? <p role="status">{t('split.allEven')}</p> : (
          <>
            <h3>{th('split.pay')}</h3>
            <ol className="plain-bullets">{transfers.map((x) => <li key={`${x.from}-${x.to}`}>{t('split.transfer', { from: names[x.from] ?? '', to: names[x.to] ?? '', amount: formatCents(x.cents) })}</li>)}</ol>
            <p className="muted">{t('split.outside')}</p>
          </>
        )}
        {split.items.length > 0 && <Button variant="secondary" onClick={() => commit(markSettled(working, now))} disabled={split.settledAt !== null}>{t('split.markSettled')}</Button>}
        {split.settledAt !== null && <p role="status">{t('split.settled')}</p>}
      </Card>
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
