import { useState } from 'react'
import { Link } from 'react-router'
import { asDisembarkView } from '../../api/guards'
import type { DisembarkView } from '../../api/finishTypes'
import { MAX_BAGS, MAX_CARRY_BAGS, WALKOFF_IDS, type WalkOffId } from '../../domain/disembark'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { SupervisedNote } from '../account/parts'
import { ExtraError, NotAboard } from '../extras/common'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { personaById } from '../../domain/personas'

/** Getting off the ship (DEB-01, DEB-02, DEB-08): the morning in order, the choice of how to leave, luggage tags. Opens with no signal from the copy on the phone. */
export function DisembarkScreen() {
  const me = usePersona()
  const copy = useSavedCopy('disembark', me?.booker ?? 'none', () => api.disembark.view(), asDisembarkView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.disembark')}</h1>
      <p>{t('dis.intro')}</p>
      {me?.child && <SupervisedNote booker={personaById(me.booker)?.firstName ?? ''} />}
      <Saved copy={copy}>{(v) => <Disembark v={v} reload={copy.retry} />}</Saved>
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}

function Disembark({ v, reload }: { v: DisembarkView; reload: () => void }) {
  const shipTime = useShipTime()
  const [option, setOption] = useState<WalkOffId>(v.option ?? 'tagged')
  const [bags, setBags] = useState<Record<string, number>>(() => Object.fromEntries(v.guests.map((g) => [g.id, v.option ? g.bags : 1])))
  const choose = useAction(async () => { await api.disembark.choose({ option, bags }); reload() })
  const tags = useAction(async (on: boolean) => { await api.disembark.setTagsOn(on); reload() })
  const max = option === 'tagged' ? MAX_BAGS : MAX_CARRY_BAGS
  const chosen = v.option
  return (
    <>
      <NotAboard open={v.canChoose || v.closed || chosen !== null} />
      {v.closed && chosen === null && <Banner kind="warning" title={t('dis.closed')}><p>{t('dis.closedBody')}</p></Banner>}
      {v.needsHelp && <Banner kind="info" title={t('dis.help')} action={<Link to="/plan/assistance">{t('route.assistance')}</Link>}><p>{t('dis.helpBody')}</p></Banner>}

      <Card hero labelledBy="dis-times-h">
        <h2 id="dis-times-h" className="card__title">{t('dis.times')}</h2>
        <dl className="plain-dl">
          <div><dt>{t('dis.arrive')}</dt><dd>{shipTime(v.times.arrivalAt)}</dd></div>
          <div><dt>{t('dis.vacate')}</dt><dd>{shipTime(v.times.vacateAt)}</dd></div>
          <div><dt>{t('dis.bagsOut')}</dt><dd>{shipTime(v.times.bagsOutAt)}</dd></div>
          <div><dt>{t('dis.tipBy')}</dt><dd>{shipTime(v.times.tipBy)}</dd></div>
        </dl>
        {v.priority && <p>{t('dis.priority')}</p>}
      </Card>

      {chosen && (
        <Card labelledBy="dis-mine-h">
          <h2 id="dis-mine-h" className="card__title">{t('dis.mine')}</h2>
          <p role="status"><strong>{t(`dis.opt.${chosen}` as StringKey)}</strong></p>
          {chosen === 'tagged' ? (
            <>
              <p className="dis__group">{t('dis.group', { color: t(`dis.color.${v.group.color}` as StringKey), number: v.group.number, time: shipTime(v.offAt.tagged) })}</p>
              <p>{t('dis.taggedBody', { time: shipTime(v.times.bagsOutAt) })}</p>
              <h3>{t('dis.tags')}</h3>
              <ul className="plain-bullets">{v.guests.filter((g) => g.label).map((g) => <li key={g.id}><strong>{g.label}</strong> ({t('dis.bagCount', { count: g.bags })})</li>)}</ul>
              <label className="choice"><input type="checkbox" checked={v.tagsOn} disabled={tags.busy || !v.canChoose} onChange={(e) => void tags.run(e.target.checked)} /><span>{t('dis.tagsOn')}</span></label>
              <ExtraError error={tags.error} />
            </>
          ) : (
            <p>{t(chosen === 'selfAssist' ? 'dis.selfBody' : 'dis.earlyBody', { time: shipTime(v.offAt[chosen]) })}</p>
          )}
        </Card>
      )}

      {v.canChoose && !v.closed && (
        <form onSubmit={(e) => { e.preventDefault(); void choose.run() }}>
          <h2>{chosen ? t('dis.change') : t('dis.choose')}</h2>
          <fieldset>
            <legend>{t('dis.how')}</legend>
            {WALKOFF_IDS.map((o) => (
              <label key={o} className="choice choice--top">
                <input type="radio" name="walkoff" checked={option === o} onChange={() => { setOption(o); setBags((b) => Object.fromEntries(Object.entries(b).map(([k, n]) => [k, Math.min(n, o === 'tagged' ? MAX_BAGS : MAX_CARRY_BAGS)]))) }} />
                <span>{t(`dis.opt.${o}` as StringKey)}<small>{t(`dis.optBody.${o}` as StringKey, { time: shipTime(v.offAt[o]) })}</small></span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('dis.bags')}</legend>
            <p className="field__hint">{option === 'tagged' ? t('dis.bagsTagged') : t('dis.bagsCarry', { count: MAX_CARRY_BAGS })}</p>
            {v.guests.map((g) => (
              <div className="field" key={g.id}>
                <label htmlFor={`bags-${g.id}`}>{t('dis.bagsFor', { name: g.name })}</label>
                <select id={`bags-${g.id}`} className="field__input field__input--short" value={Math.min(bags[g.id] ?? 0, max)} onChange={(e) => setBags({ ...bags, [g.id]: Number(e.target.value) })}>
                  {Array.from({ length: max + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </fieldset>
          <ExtraError error={choose.error} />
          <Button type="submit" disabled={choose.busy}>{choose.busy ? t('account.saving') : t('dis.save')}</Button>
        </form>
      )}

      <section aria-labelledby="dis-morning-h">
        <h2 id="dis-morning-h">{t('dis.morning')}</h2>
        <ol className="plain-bullets">{(['pack', 'breakfast', 'vacate', 'wait', 'leave', 'customs', 'bags'] as const).map((k) => <li key={k}>{t(`dis.step.${k}` as StringKey)}</li>)}</ol>
      </section>

      <nav aria-labelledby="dis-links-h">
        <h2 id="dis-links-h">{t('dis.more')}</h2>
        <ul className="link-list">
          <li><Link to="/home/disembark/final-night">{t('route.finalNight')}{!v.customsDone && <span className="tag tag--alert">{t('dis.todo')}</span>}</Link></li>
          <li><Link to="/home/disembark/customs">{t('route.customs')}{v.customsDone && <span className="tag tag--good">{t('dis.done')}</span>}</Link></li>
          <li><Link to="/home/disembark/onward">{t('route.onward')}{v.onwardSaved && <span className="tag tag--good">{t('dis.done')}</span>}</Link></li>
          <li><Link to="/me/bill/final">{t('route.finalBill')}</Link></li>
          <li><Link to="/me/cases">{t('route.cases')}</Link></li>
          <li><Link to="/ship/photos">{t('route.photos')}</Link></li>
        </ul>
      </nav>
    </>
  )
}
