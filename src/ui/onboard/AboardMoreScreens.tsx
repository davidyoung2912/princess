import { useState } from 'react'
import { Link } from 'react-router'
import { calmestPlaces, cabinWords, challenge, diningPlaces, DND_MAX, findCabin, HOLD_MINUTES, kidsReport, LAP_STEPS, loungerBoard, matchFound, OK_HOURS, okStatus, seasickStatus, seenToday, SEASICK_DOCTOR, SEASICK_HELPS, SIGHTINGS_MAX, soloState, SOLO_MINUTES, SPECIES, startSolo, STEP_GOAL, takeLounger, teenComplete, TEEN_RULES, YOU_SAID, FOUND, LOST_MAX, type AboardState } from '../../domain/aboardMore'
import { clubById, clubFor } from '../../domain/family'
import { placeById } from '../../domain/deck'
import { shipZoneAt } from '../../domain/sailings'
import { timeIn } from '../../domain/timezones'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { normalizeBrief } from '../../domain/planning'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'

const Page = ({ title, intro, children }: { title: StringKey; intro: StringKey; children: React.ReactNode }) => (
  <div className="page">
    <BackLink to="/ship" label={t('route.ship')} />
    <h1>{t(title)}</h1>
    <p>{t(intro)}</p>
    {children}
  </div>
)

/** The on-board state on this device and a way to change just that part. */
function useAboard() {
  const { state, update } = useMemory()
  const set = (change: (a: AboardState) => AboardState) => update((s) => ({ ...s, aboard: change(s.aboard) }))
  return { a: state.aboard, set, memory: state }
}

const Nothing = ({ k }: { k: StringKey }) => <Banner kind="info" title={t(k)} />

/** Seasickness first aid (S6-09): the calmest places, what helps, when to see the doctor, and a one-tap request. */
export function SeasickScreen() {
  const { a, set } = useAboard()
  const now = useNow()
  const status = seasickStatus(a.seasick, now)
  return (
    <Page title="route.seasick" intro="sick.intro">
      <Card labelledBy="sick-where"><h2 id="sick-where" className="card__title">{t('sick.where')}</h2>
        <ul className="plain-list">{calmestPlaces().map((p) => <li key={p.id}>{p.name}, {t('quiet.deck', { deck: p.deck })}</li>)}</ul>
        <p className="muted">{t('sick.whereNote')}</p></Card>
      <Card labelledBy="sick-helps"><h2 id="sick-helps" className="card__title">{t('sick.helps')}</h2>
        <ul>{SEASICK_HELPS.map((k) => <li key={k}>{t(`sick.help.${k}` as StringKey)}</li>)}</ul></Card>
      <Card labelledBy="sick-doc"><h2 id="sick-doc" className="card__title">{t('sick.doctor')}</h2>
        <ul>{SEASICK_DOCTOR.map((k) => <li key={k}>{t(`sick.doc.${k}` as StringKey)}</li>)}</ul>
        <LinkButton to="/ship/health" variant="secondary">{t('sick.medical')}</LinkButton></Card>
      <Card labelledBy="sick-ask"><h2 id="sick-ask" className="card__title">{t('sick.ask')}</h2>
        {status === 'none' ? <Button onClick={() => set((x) => ({ ...x, seasick: now }))}>{t('sick.askButton')}</Button> : <p role="status">{t(`sick.status.${status}` as StringKey)}</p>}
        {status !== 'none' && <Button variant="tertiary" onClick={() => set((x) => ({ ...x, seasick: null }))}>{t('sick.cancel')}</Button>}
        <p className="muted">{t('sick.simulated')}</p></Card>
    </Page>
  )
}

/** Lounger fair use (S6-10), on a simulated board: a timed hold, when it returns, and a report for one left too long. */
export function LoungersScreen() {
  const { a, set } = useAboard()
  const now = useNow()
  const board = loungerBoard(now, a.lounger, a.reported)
  return (
    <Page title="route.loungers" intro="lounge.intro">
      <Banner kind="info" title={t('lounge.sim')} />
      <ul className="card-grid">
        {board.map((r) => (
          <li key={r.id}>
            <Card labelledBy={`l-${r.id}`}>
              <h2 id={`l-${r.id}`} className="card__title">{t('lounge.n', { n: r.id })}</h2>
              <p>{t(`lounge.state.${r.state}` as StringKey, { min: r.returnsIn ?? 0 })}</p>
              {r.state === 'free' && <Button onClick={() => set((x) => ({ ...x, lounger: takeLounger(board, x.lounger, r.id, now) }))}>{t('lounge.take', { min: HOLD_MINUTES })}</Button>}
              {r.state === 'mine' && <Button variant="secondary" onClick={() => set((x) => ({ ...x, lounger: null }))}>{t('lounge.release')}</Button>}
              {r.state === 'overdue' && <Button variant="secondary" onClick={() => set((x) => ({ ...x, reported: [...x.reported, r.id] }))}>{t('lounge.report')}</Button>}
            </Card>
          </li>
        ))}
      </ul>
      <p className="muted">{t('lounge.rule', { min: HOLD_MINUTES })}</p>
    </Page>
  )
}

/** Kids' daily report (S6-13): a simulated summary from the club, shown only after a parent agrees. */
export function KidsReportScreen() {
  const { a, set, memory } = useAboard()
  const day = useCurrentDay()
  const brief = memory.planning.brief
  const club = brief.age === null ? undefined : clubFor(brief.age)
  return (
    <Page title="route.kidsReport" intro="kreport.intro">
      <label className="choice"><input type="checkbox" checked={a.kidsConsent} onChange={(e) => set((x) => ({ ...x, kidsConsent: e.target.checked }))} /><span>{t('kreport.consent')}</span></label>
      {!club ? <p>{t('kreport.needBrief')} <Link to="/plan/child-brief">{t('route.childBrief')}</Link></p> : !a.kidsConsent ? <Nothing k="kreport.waiting" /> : (
        <Card labelledBy="kr-h"><h2 id="kr-h" className="card__title">{t('kreport.title', { club: clubById(club.id)?.name ?? club.id, day })}</h2>
          {kidsReport(normalizeBrief(brief).name, club.id, day).map((l) => <p key={l}>{l}</p>)}
          <p className="muted">{t('kreport.sim')}</p></Card>
      )}
    </Page>
  )
}

/** Teen agreement (S6-14): rules agreed together and signed by both. Kept here; nothing is sent. */
export function TeenScreen() {
  const { a, set } = useAboard()
  const tn = a.teen
  const put = (n: Partial<typeof tn>) => set((x) => ({ ...x, teen: { ...x.teen, ...n } }))
  return (
    <Page title="route.teen" intro="teen.intro">
      <Banner kind="info" title={t('teen.nothingSent')} />
      <Field label={t('teen.name')} value={tn.name} maxLength={30} onChange={(e) => put({ name: e.target.value })} />
      <fieldset><legend>{t('teen.rules')}</legend>
        {TEEN_RULES.map((r) => <label key={r} className="choice"><input type="checkbox" checked={tn.agreed.includes(r)} onChange={(e) => put({ agreed: e.target.checked ? [...tn.agreed, r] : tn.agreed.filter((k) => k !== r) })} /><span>{t(`teen.rule.${r}` as StringKey)}</span></label>)}
      </fieldset>
      <label className="choice"><input type="checkbox" checked={tn.teenSigned} onChange={(e) => put({ teenSigned: e.target.checked })} /><span>{t('teen.signTeen')}</span></label>
      <label className="choice"><input type="checkbox" checked={tn.parentSigned} onChange={(e) => put({ parentSigned: e.target.checked })} /><span>{t('teen.signParent')}</span></label>
      <p role="status">{teenComplete(tn) ? t('teen.done') : t('teen.notDone')}</p>
    </Page>
  )
}

/** "I'm OK" tap (S6-15): the guest taps; the screen says when the next one is due. Nothing is sent to anyone. */
export function OkTapScreen() {
  const { a, set } = useAboard()
  const now = useNow()
  const s = okStatus(a.ok, now)
  return (
    <Page title="route.okTap" intro="ok.intro">
      <Banner kind="info" title={t('ok.nothingSent')} />
      <Button block onClick={() => set((x) => ({ ...x, ok: { ...x.ok, lastAt: now } }))}>{t('ok.tap')}</Button>
      <p role="status">{t(`ok.status.${s}` as StringKey)}</p>
      <fieldset><legend>{t('ok.every')}</legend>
        {OK_HOURS.map((h) => <label key={h} className="choice"><input type="radio" name="ok-every" checked={a.ok.every === h} onChange={() => set((x) => ({ ...x, ok: { ...x.ok, every: h } }))} /><span>{t('ok.hours', { n: h })}</span></label>)}
      </fieldset>
    </Page>
  )
}

/** Solo safety timer (S6-17): set it before going somewhere alone; the screen shows when it is due. Nothing is sent. */
export function SoloScreen() {
  const { a, set } = useAboard()
  const now = useNow()
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState<number>(60)
  const sailing = useSailing()
  const s = soloState(a.solo, now)
  return (
    <Page title="route.solo" intro="solo.intro">
      <Banner kind="warning" title={t('solo.nothingSent')} />
      {s === 'none' ? (
        <>
          <Field label={t('solo.where')} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
          <label htmlFor="solo-min">{t('solo.back')}</label>
          <select id="solo-min" className="field__input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{SOLO_MINUTES.map((m) => <option key={m} value={m}>{t('solo.minutes', { n: m })}</option>)}</select>
          <Button onClick={() => set((x) => ({ ...x, solo: startSolo(label, minutes, now) }))}>{t('solo.start')}</Button>
        </>
      ) : (
        <>
          <p role="status"><strong>{t(`solo.state.${s}` as StringKey, { where: a.solo?.label || t('solo.somewhere'), at: a.solo ? timeIn(a.solo.dueAt, shipZoneAt(sailing, a.solo.dueAt)) : '' })}</strong></p>
          <Button onClick={() => set((x) => ({ ...x, solo: null }))}>{t('solo.safe')}</Button>
        </>
      )}
    </Page>
  )
}

/** Do-not-disturb schedules (S6-18): up to four, on top of the nudge budget. Critical and safety notices always come through. */
export function DndScreen() {
  const { a, set } = useAboard()
  const patch = (id: string, n: Partial<AboardState['dnd'][number]>) => set((x) => ({ ...x, dnd: x.dnd.map((d) => (d.id === id ? { ...d, ...n } : d)) }))
  return (
    <Page title="route.dnd" intro="dnd.intro">
      <Banner kind="info" title={t('dnd.critical')} />
      {a.dnd.map((d) => (
        <Card key={d.id} labelledBy={`dnd-${d.id}`}>
          <h2 id={`dnd-${d.id}`} className="card__title">{d.from} – {d.to}</h2>
          <label className="choice"><input type="checkbox" checked={d.on} onChange={(e) => patch(d.id, { on: e.target.checked })} /><span>{t('dnd.on')}</span></label>
          <Field label={t('dnd.from')} type="time" value={d.from} onChange={(e) => e.target.value && patch(d.id, { from: e.target.value })} />
          <Field label={t('dnd.to')} type="time" value={d.to} onChange={(e) => e.target.value && patch(d.id, { to: e.target.value })} />
          <Button variant="tertiary" onClick={() => set((x) => ({ ...x, dnd: x.dnd.filter((y) => y.id !== d.id) }))}>{t('poll.remove')}</Button>
        </Card>
      ))}
      {a.dnd.length < DND_MAX && <Button onClick={() => set((x) => ({ ...x, dnd: [...x.dnd, { id: newMemoryId(), from: '22:00', to: '07:00', on: true }] }))}>{t('dnd.add')}</Button>}
      <p className="muted"><Link to="/me/notifications">{t('route.notifications')}</Link></p>
    </Page>
  )
}

/** "You said, we did" (S6-19): what guests asked for and what changed. An authored board. */
export function YouSaidScreen() {
  return (
    <Page title="route.youSaid" intro="said.intro">
      <ul className="card-grid">{YOU_SAID.map((k) => <li key={k}><Card labelledBy={`s-${k}`}><h2 id={`s-${k}`} className="card__title">{t(`said.${k}.said` as StringKey)}</h2><p>{t(`said.${k}.did` as StringKey)}</p></Card></li>)}</ul>
      <p className="muted">{t('said.sim')}</p>
    </Page>
  )
}

/** Dining favourites and table preferences (S6-20): kept here, shown to the host when the guest asks. */
export function DiningPrefsScreen() {
  const { a, set } = useAboard()
  const d = a.dining
  const table = (n: Partial<typeof d.table>) => set((x) => ({ ...x, dining: { ...x.dining, table: { ...x.dining.table, ...n } } }))
  return (
    <Page title="route.diningPrefs" intro="dpref.intro">
      <Card labelledBy="dp-fav"><h2 id="dp-fav" className="card__title">{t('dpref.fav')}</h2>
        {diningPlaces().map((p) => <label key={p.id} className="choice"><input type="checkbox" checked={d.favourites.includes(p.id)} onChange={(e) => set((x) => ({ ...x, dining: { ...x.dining, favourites: e.target.checked ? [...x.dining.favourites, p.id] : x.dining.favourites.filter((f) => f !== p.id) } }))} /><span>{p.name}</span></label>)}</Card>
      <Card labelledBy="dp-table"><h2 id="dp-table" className="card__title">{t('dpref.table')}</h2>
        <label htmlFor="dp-size">{t('dpref.size')}</label>
        <select id="dp-size" className="field__input" value={d.table.size} onChange={(e) => table({ size: e.target.value as typeof d.table.size })}>{(['any', '2', '4', '6'] as const).map((s) => <option key={s} value={s}>{t(`dpref.size.${s}` as StringKey)}</option>)}</select>
        <label htmlFor="dp-time">{t('dpref.time')}</label>
        <select id="dp-time" className="field__input" value={d.table.time} onChange={(e) => table({ time: e.target.value as typeof d.table.time })}>{(['any', 'early', 'late'] as const).map((s) => <option key={s} value={s}>{t(`dpref.time.${s}` as StringKey)}</option>)}</select>
        <label className="choice"><input type="checkbox" checked={d.table.quiet} onChange={(e) => table({ quiet: e.target.checked })} /><span>{t('dpref.quiet')}</span></label></Card>
      {d.favourites.length > 0 && <p role="status">{t('dpref.summary', { places: d.favourites.map((f) => placeById(f)?.name ?? f).join(', ') })}</p>}
      <p><Link to="/plan/dining">{t('route.dining')}</Link></p>
    </Page>
  )
}

/** Step and deck-lap challenge (S6-21): the guest types the day's steps; the screen counts goal days and laps. Single device. */
export function StepsScreen() {
  const { a, set } = useAboard()
  const day = useCurrentDay()
  const [text, setText] = useState(String(a.steps[String(day)] ?? ''))
  const c = challenge(a.steps, day)
  return (
    <Page title="route.steps" intro="steps.intro">
      <Field label={t('steps.today', { day })} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      <Button onClick={() => set((x) => ({ ...x, steps: { ...x.steps, [String(day)]: Math.min(100_000, Number(text || '0')) } }))}>{t('steps.save')}</Button>
      <Card labelledBy="steps-h"><h2 id="steps-h" className="card__title">{t('steps.progress')}</h2>
        <p>{t('steps.total', { n: c.total.toLocaleString('en-US') })}</p>
        <p>{t('steps.laps', { n: c.laps, steps: LAP_STEPS })}</p>
        <p>{t('steps.days', { n: c.daysMet, goal: STEP_GOAL.toLocaleString('en-US') })}</p>
        <progress className="meter" max={STEP_GOAL} value={Math.min(STEP_GOAL, STEP_GOAL - c.toGoal)} aria-label={t('steps.toGoal', { n: c.toGoal })} />
        <p>{c.toGoal === 0 ? t('steps.met') : t('steps.toGoal', { n: c.toGoal.toLocaleString('en-US') })}</p></Card>
      <p className="muted">{t('steps.note')}</p>
    </Page>
  )
}

/** Lost and found (S6-25): a report kept on this device, matched against an authored list of what has been handed in. */
export function LostFoundScreen() {
  const { a, set } = useAboard()
  const now = useNow()
  const [what, setWhat] = useState('')
  const [where, setWhere] = useState('')
  return (
    <Page title="route.lostFound" intro="lost.intro">
      <Banner kind="info" title={t('lost.local')} />
      <Field label={t('lost.what')} value={what} maxLength={80} onChange={(e) => setWhat(e.target.value)} />
      <Field label={t('lost.where')} value={where} maxLength={80} onChange={(e) => setWhere(e.target.value)} />
      <Button disabled={!what.trim() || a.lost.length >= LOST_MAX} onClick={() => { set((x) => ({ ...x, lost: [...x.lost, { id: newMemoryId(), what: what.trim(), where: where.trim(), at: now }] })); setWhat(''); setWhere('') }}>{t('lost.save')}</Button>
      {a.lost.map((r) => {
        const m = matchFound(r)
        return (
          <Card key={r.id} labelledBy={`lost-${r.id}`}>
            <h2 id={`lost-${r.id}`} className="card__title">{r.what}</h2>
            {r.where && <p className="muted">{r.where}</p>}
            <p role="status">{m.length > 0 ? t('lost.maybe', { what: m.map((f) => `${f.what} (${placeById(f.at)?.name ?? f.at})`).join('; ') }) : t('lost.none')}</p>
            <Button variant="tertiary" onClick={() => set((x) => ({ ...x, lost: x.lost.filter((y) => y.id !== r.id) }))}>{t('poll.remove')}</Button>
          </Card>
        )
      })}
      <Card labelledBy="found-h"><h2 id="found-h" className="card__title">{t('lost.found')}</h2><ul>{FOUND.map((f) => <li key={f.id}>{f.what}, {placeById(f.at)?.name}</li>)}</ul><p className="muted">{t('lost.sim')}</p></Card>
      <p><Link to="/me/cases">{t('route.cases')}</Link></p>
    </Page>
  )
}

/** Sightings log (S6-08): what the guest saw, and what the ship is said to have seen today (authored and simulated). */
export function SightingsScreen() {
  const { a, set } = useAboard()
  const day = useCurrentDay()
  const [pick, setPick] = useState<string>(SPECIES[0])
  return (
    <Page title="route.sightings" intro="sight.intro">
      <Card labelledBy="sight-today"><h2 id="sight-today" className="card__title">{t('sight.today')}</h2>
        <p>{seenToday(day).map((s) => t(`sight.${s}` as StringKey)).join(', ')}</p><p className="muted">{t('sight.sim')}</p></Card>
      <label htmlFor="sight-pick">{t('sight.saw')}</label>
      <select id="sight-pick" className="field__input" value={pick} onChange={(e) => setPick(e.target.value)}>{SPECIES.map((s) => <option key={s} value={s}>{t(`sight.${s}` as StringKey)}</option>)}</select>
      <Button disabled={a.sightings.length >= SIGHTINGS_MAX} onClick={() => set((x) => ({ ...x, sightings: [...x.sightings, { id: newMemoryId(), species: pick, day }] }))}>{t('sight.log')}</Button>
      <ul className="plain-list">{a.sightings.map((s) => <li key={s.id}>{t('sight.row', { day: s.day, what: t(`sight.${s.species}` as StringKey) })} <Button variant="tertiary" onClick={() => set((x) => ({ ...x, sightings: x.sightings.filter((y) => y.id !== s.id) }))}>{t('poll.remove')}</Button></li>)}</ul>
    </Page>
  )
}

/** A words-only route to the cabin (S6-16), for the calm screen: lift bank, deck, side and number, with no map to read. */
export function CabinWordsCard() {
  const { a, set } = useAboard()
  const [text, setText] = useState(a.cabin)
  const cabin = a.cabin ? findCabin(a.cabin) : null
  const words = cabin ? cabinWords(cabin) : null
  return (
    <Card labelledBy="cw-h">
      <h2 id="cw-h" className="card__title">{t('cw.title')}</h2>
      <Field label={t('cw.number')} inputMode="numeric" value={text} maxLength={6} onChange={(e) => setText(e.target.value.replace(/\D/g, ''))} error={a.cabin && !cabin ? t('cw.unknown') : undefined} />
      <Button variant="secondary" onClick={() => set((x) => ({ ...x, cabin: text.trim() }))}>{t('cw.show')}</Button>
      {words && <ol>{words.steps.map((s) => <li key={s.key}>{t(`cw.step.${s.key}` as StringKey, s.params)}</li>)}</ol>}
      <p className="muted">{t('cw.note')}</p>
    </Card>
  )
}
