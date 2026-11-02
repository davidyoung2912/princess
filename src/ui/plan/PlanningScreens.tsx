import { SharingNote } from '../SharingNote'
import { useState } from 'react'
import { Link } from 'react-router'
import { ledgerSummary } from '../../domain/bookingPrep'
import { EXCURSIONS, excursionById } from '../../domain/excursions'
import { useCatalogue } from '../../hooks/useCatalogue'
import { clubById } from '../../domain/family'
import { formatMoney } from '../../domain/money'
import { PORTS } from '../../domain/sailings'
import { addIdea, addTradition, briefFor, carryOver, castVote, compareExcursion, difficultyConcerns, difficultyOf, heartIdea, leader, newPoll, normalizeBrief, PRIVACY_FIELDS, rhythmPrefs, sharedDay, tally, tasteInferences, withoutSurprises, type PlanningState, type Rhythm } from '../../domain/planning'
import { usePilot } from '../../hooks/usePilot'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { useParty } from '../../hooks/useParty'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'

const Page = ({ title, intro, children }: { title: StringKey; intro: StringKey; children: React.ReactNode }) => (
  <div className="page">
    <BackLink to="/plan" label={t('route.plan')} />
    <h1>{t(title)}</h1>
    <p>{t(intro)}</p>
    {children}
  </div>
)

/** The planning state on this device and a way to change just that part. */
function usePlanning() {
  const { state, update, me } = useMemory()
  const set = (change: (p: PlanningState) => PlanningState) => update((s) => ({ ...s, planning: change(s.planning) }))
  return { p: state.planning, set, memory: state, me }
}

/** Honest difficulty (S4-03): distance, steps, heat, shade, seats, restrooms and wet footing for each excursion, with what could be hard for this guest's profile. */
export function DifficultyScreen() {
  useCatalogue()
  const { memory } = usePlanning()
  return (
    <Page title="route.difficulty" intro="diff.intro">
      <ul className="card-grid">
        {EXCURSIONS.map((x) => {
          const d = difficultyOf(x.id)!
          const concerns = difficultyConcerns(x, memory.access)
          return (
            <li key={x.id}>
              <Card labelledBy={`d-${x.id}`}>
                <h2 id={`d-${x.id}`} className="card__title">{x.name}</h2>
                <p className="muted">{PORTS[x.port].name.split(',')[0]}</p>
                <ul className="plain-list">
                  <li>{t('diff.km', { km: d.km })}</li>
                  <li>{d.steps ? t('diff.steps') : t('diff.noSteps')}</li>
                  <li>{t('diff.heat', { heat: t(`diff.level.${d.heat}` as StringKey), shade: t(`diff.level.${d.shade}` as StringKey) })}</li>
                  <li>{d.seats ? t('diff.seats') : t('diff.noSeats')}</li>
                  <li>{d.restrooms ? t('diff.restrooms') : t('diff.noRestrooms')}</li>
                  {d.wet && <li>{t('diff.wet')}</li>}
                </ul>
                {concerns.length > 0
                  ? <Banner kind="warning" title={t('diff.forYou')}>{concerns.map((c) => t(`diff.concern.${c}` as StringKey)).join(' ')}</Banner>
                  : <p className="muted">{t('diff.none')}</p>}
              </Card>
            </li>
          )
        })}
      </ul>
      <p><Link to="/plan/access">{t('route.accessProfile')}</Link></p>
    </Page>
  )
}

/** Independent against ship excursion (S4-04): cost, risk, flexibility and what happens if you are late. */
export function CompareScreen() {
  useCatalogue()
  const [id, setId] = useState(EXCURSIONS[0].id)
  const x = excursionById(id)!
  const c = compareExcursion(x)
  const rows: [StringKey, string, string][] = [
    ['cmp.cost', formatMoney(c.ship.cost), formatMoney(c.independent.cost)],
    ['cmp.late', t('cmp.late.shipWaits'), t('cmp.late.shipLeaves')],
    ['cmp.flex', t('cmp.flex.no'), t('cmp.flex.yes')],
    ['cmp.refund', t('cmp.refund.cancel'), t('cmp.refund.varies')],
  ]
  return (
    <Page title="route.compare" intro="cmp.intro">
      <label htmlFor="cmp-x">{t('cmp.pick')}</label>
      <select id="cmp-x" className="field__input" value={id} onChange={(e) => setId(e.target.value)}>
        {EXCURSIONS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <table className="table">
        <caption>{x.name}</caption>
        <thead><tr><th scope="col">{t('cmp.what')}</th><th scope="col">{t('cmp.ship')}</th><th scope="col">{t('cmp.own')}</th></tr></thead>
        <tbody>{rows.map(([k, a, b]) => <tr key={k}><th scope="row">{t(k)}</th><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
      <p role="status">{t('cmp.saving', { amount: formatMoney(c.saving) })}</p>
      <p className="muted">{t('cmp.note')}</p>
    </Page>
  )
}

/** Group poll and dream board (S4-05, S0-06), run on this one phone: the organiser passes it round or types the votes in. */
export function GroupPollScreen() {
  const { p, set } = usePlanning()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')
  const [voter, setVoter] = useState('')
  const [idea, setIdea] = useState('')
  const [problem, setProblem] = useState(false)
  const create = () => {
    const poll = newPoll(newMemoryId(), question, options.split(',').map((o) => o.trim()))
    setProblem(!poll)
    if (poll) { set((s) => ({ ...s, polls: [...s.polls, poll].slice(-6) })); setQuestion(''); setOptions('') }
  }
  return (
    <Page title="route.groupPoll" intro="poll.intro">
      <Banner kind="info" title={t('poll.single')} />
      <Card labelledBy="poll-new">
        <h2 id="poll-new" className="card__title">{t('poll.new')}</h2>
        <Field label={t('poll.question')} value={question} maxLength={80} onChange={(e) => setQuestion(e.target.value)} />
        <Field label={t('poll.options')} hint={t('poll.optionsHint')} value={options} maxLength={200} onChange={(e) => setOptions(e.target.value)} error={problem ? t('poll.problem') : undefined} />
        <Button onClick={create}>{t('poll.create')}</Button>
      </Card>
      {p.polls.length > 0 && <Field label={t('poll.voter')} hint={t('poll.voterHint')} value={voter} maxLength={20} onChange={(e) => setVoter(e.target.value)} />}
      {p.polls.map((poll) => {
        const win = leader(poll)
        return (
          <Card key={poll.id} labelledBy={`poll-${poll.id}`}>
            <h2 id={`poll-${poll.id}`} className="card__title">{poll.question}</h2>
            <ul className="plain-list">
              {tally(poll).map(({ option, votes }) => (
                <li key={option.id}>
                  <Button variant="secondary" disabled={!voter.trim()} onClick={() => set((s) => ({ ...s, polls: s.polls.map((x) => (x.id === poll.id ? castVote(x, voter, option.id) : x)) }))}>{option.label}</Button>{' '}
                  <span>{t('poll.votes', { n: votes })}</span>
                </li>
              ))}
            </ul>
            {!voter.trim() && <p className="muted">{t('poll.needName')}</p>}
            <p role="status">{win ? t('poll.leader', { label: win.label }) : t('poll.noLeader')}</p>
            <Button variant="tertiary" onClick={() => set((s) => ({ ...s, polls: s.polls.filter((x) => x.id !== poll.id) }))}>{t('poll.remove')}</Button>
          </Card>
        )
      })}
      <Card labelledBy="board-h">
        <h2 id="board-h" className="card__title">{t('board.title')}</h2>
        <p>{t('board.intro')}</p>
        <Field label={t('board.add')} value={idea} maxLength={80} onChange={(e) => setIdea(e.target.value)} />
        <Button onClick={() => { set((s) => ({ ...s, ideas: addIdea(s.ideas, newMemoryId(), idea) })); setIdea('') }}>{t('board.addButton')}</Button>
        <ul className="plain-list">
          {[...p.ideas].sort((a, b) => b.hearts.length - a.hearts.length).map((i) => (
            <li key={i.id}>
              {i.text} <span className="muted">{t('board.hearts', { n: i.hearts.length })}</span>{' '}
              <Button variant="tertiary" disabled={!voter.trim()} onClick={() => set((s) => ({ ...s, ideas: heartIdea(s.ideas, i.id, voter) }))}>{t('board.heart')}</Button>
              <Button variant="tertiary" onClick={() => set((s) => ({ ...s, ideas: s.ideas.filter((x) => x.id !== i.id) }))}>{t('poll.remove')}</Button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="muted">{t('poll.notShared')}</p>
    </Page>
  )
}

/** Surprise mode (S4-06): hidden items stay out of any list that goes to other people. */
export function SurprisesScreen() {
  const { p, set } = usePlanning()
  const [text, setText] = useState('')
  const [pretend, setPretend] = useState(false)
  const demo = [{ id: 'd1', title: 'Dinner at 7' }, ...p.surprises.map((s) => ({ id: s.id, title: s.text }))]
  return (
    <Page title="route.surprises" intro="surp.intro">
      <Field label={t('surp.add')} hint={t('surp.hint')} value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
      <Button disabled={!text.trim()} onClick={() => { set((s) => ({ ...s, surprises: [...s.surprises, { id: newMemoryId(), text: text.trim() }].slice(0, 10) })); setText('') }}>{t('surp.addButton')}</Button>
      <ul className="plain-list">{p.surprises.map((s) => <li key={s.id}>{s.text} <Button variant="tertiary" onClick={() => set((x) => ({ ...x, surprises: x.surprises.filter((y) => y.id !== s.id) }))}>{t('poll.remove')}</Button></li>)}</ul>
      <Card labelledBy="surp-view">
        <h2 id="surp-view" className="card__title">{t('surp.view')}</h2>
        <label className="choice"><input type="checkbox" checked={pretend} onChange={(e) => setPretend(e.target.checked)} /><span>{t('surp.asGuest')}</span></label>
        <ul className="plain-list">{(pretend ? withoutSurprises(demo, p.surprises) : demo).map((i) => <li key={i.id}>{i.title}</li>)}</ul>
      </Card>
    </Page>
  )
}

/** One taste profile and "visible brain" (S4-07, XA-07): every guess listed with why, each removable, one switch for all. */
export function TasteScreen() {
  const { p, set, memory } = usePlanning()
  const { state: pilot } = usePilot()
  const list = tasteInferences({ fit: memory.fit, pasted: memory.pasted, pace: pilot.prefs.pace, rhythm: p.rhythm }, p.tasteOff, p.tasteRemoved)
  return (
    <Page title="route.taste" intro="taste.intro">
      <label className="choice"><input type="checkbox" checked={p.tasteOff} onChange={(e) => set((s) => ({ ...s, tasteOff: e.target.checked }))} /><span>{t('taste.off')}</span></label>
      {p.tasteOff && <p role="status">{t('taste.isOff')}</p>}
      <ul className="plain-list">
        {list.map((i) => (
          <li key={i.id}>{i.text} <span className="muted">({t(`taste.from.${i.source}` as StringKey)})</span>{' '}
            <Button variant="tertiary" onClick={() => set((s) => ({ ...s, tasteRemoved: [...s.tasteRemoved, i.id] }))}>{t('taste.remove')}</Button></li>
        ))}
      </ul>
      {!p.tasteOff && list.length === 0 && <p>{t('taste.empty')}</p>}
      {p.tasteRemoved.length > 0 && <Button variant="secondary" onClick={() => set((s) => ({ ...s, tasteRemoved: [] }))}>{t('taste.restore')}</Button>}
      <p className="muted">{t('taste.note')}</p>
    </Page>
  )
}

/** Child brief (S4-09): written once, shown with the fields the right club would see. Nothing is sent. */
export function ChildBriefScreen() {
  const { p, set } = usePlanning()
  const b = p.brief
  const field = (k: 'name' | 'allergies' | 'comfort' | 'bedtime' | 'needs', max: number) => <Field label={t(`brief.${k}` as StringKey)} value={b[k]} maxLength={max} onChange={(e) => set((s) => ({ ...s, brief: normalizeBrief({ ...s.brief, [k]: e.target.value }) }))} />
  const view = briefFor(b)
  return (
    <Page title="route.childBrief" intro="cbrief.intro">
      {field('name', 30)}
      <div className="field">
        <label htmlFor="brief-age">{t('brief.age')}</label>
        <select id="brief-age" className="field__input" value={b.age ?? ''} onChange={(e) => set((s) => ({ ...s, brief: { ...s.brief, age: e.target.value ? Number(e.target.value) : null } }))}>
          <option value="">{t('brief.ageNone')}</option>
          {Array.from({ length: 15 }, (_, i) => i + 3).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {field('allergies', 120)}{field('comfort', 120)}{field('bedtime', 20)}{field('needs', 160)}
      <Card labelledBy="brief-view">
        <h2 id="brief-view" className="card__title">{view ? t('brief.club', { club: clubById(view.club)?.name ?? view.club }) : t('brief.noClub')}</h2>
        {view && <ul className="plain-list">{view.fields.map((f) => <li key={f.field}><strong>{t(`brief.${f.field}` as StringKey)}:</strong> {f.value}</li>)}</ul>}
        <p className="muted">{t('brief.note')}</p>
      </Card>
    </Page>
  )
}

/** Rhythm profile (S4-10): how the guest likes their days, feeding the week optimiser when they choose. */
export function RhythmScreen() {
  const { p, set } = usePlanning()
  const { update } = usePilot()
  const r: Rhythm = p.rhythm ?? { wake: 'mid', nap: false, lateMeals: false }
  const save = (n: Partial<Rhythm>) => set((s) => ({ ...s, rhythm: { ...r, ...n } }))
  const [done, setDone] = useState(false)
  return (
    <Page title="route.rhythm" intro="rhythm.intro">
      <fieldset>
        <legend>{t('rhythm.wake')}</legend>
        {(['early', 'mid', 'late'] as const).map((w) => <label key={w} className="choice"><input type="radio" name="rhythm-wake" checked={r.wake === w} onChange={() => save({ wake: w })} /><span>{t(`rhythm.wake.${w}` as StringKey)}</span></label>)}
      </fieldset>
      <label className="choice"><input type="checkbox" checked={r.nap} onChange={(e) => save({ nap: e.target.checked })} /><span>{t('rhythm.nap')}</span></label>
      <label className="choice"><input type="checkbox" checked={r.lateMeals} onChange={(e) => save({ lateMeals: e.target.checked })} /><span>{t('rhythm.late')}</span></label>
      <Button onClick={() => { update((s) => ({ ...s, prefs: { ...s.prefs, ...rhythmPrefs(r) } })); setDone(true) }}>{t('rhythm.apply')}</Button>
      {done && <p role="status">{t('rhythm.applied')}</p>}
      {p.rhythm && <Button variant="tertiary" onClick={() => set((s) => ({ ...s, rhythm: null }))}>{t('rhythm.clear')}</Button>}
    </Page>
  )
}

/** Organiser dashboard and privacy defaults (XG-01, XG-02), from what the booking already holds on this device. */
export function OrganiserScreen() {
  const { p, set, memory } = usePlanning()
  const party = useParty()
  const trips = useMine(() => api.trips.list())
  const led = ledgerSummary(memory.shares)
  return (
    <Page title="route.organiser" intro="org.intro">
      <Load state={trips}>
        {(v) => (
          <Card labelledBy="org-h">
            <h2 id="org-h" className="card__title">{t('org.title')}</h2>
            <ul className="plain-list">
              <li>{t('org.guests', { n: v.upcoming[0]?.guests ?? 1 })}</li>
              <li>{t('org.invited', { n: party.state.invites.length })}</li>
              <li>{t('org.notes', { n: party.state.notes.length })}</li>
              <li>{t('org.owed', { owed: formatMoney(led.owed), paid: formatMoney(led.paid) })}</li>
            </ul>
            <p><Link to="/plan/party">{t('route.party')}</Link> · <Link to="/plan/shares">{t('route.shares')}</Link> · <Link to="/plan/cabins">{t('route.cabins2')}</Link></p>
          </Card>
        )}
      </Load>
      <Card labelledBy="org-priv">
        <h2 id="org-priv" className="card__title">{t('org.privacy')}</h2>
        <p>{t('org.privacyIntro')}</p>
        {PRIVACY_FIELDS.map((f) => (
          <label key={f} className="choice">
            <input type="checkbox" checked={p.privacy[f]} disabled={f === 'medical'} onChange={(e) => set((s) => ({ ...s, privacy: { ...s.privacy, [f]: e.target.checked } }))} />
            <span>{t(`org.field.${f}` as StringKey)}{f === 'medical' ? ` ${t('org.never')}` : ''}</span>
          </label>
        ))}
      </Card>
    </Page>
  )
}

/** Several cabins, one shared day (XG-07): what the cabins do together and what only some do. */
export function CabinsScreen() {
  useCatalogue()
  const { p, set } = usePlanning()
  const [name, setName] = useState('')
  const toggle = (id: string, tour: string) => set((s) => ({ ...s, cabins: s.cabins.map((c) => (c.id === id ? { ...c, tourIds: c.tourIds.includes(tour) ? c.tourIds.filter((x) => x !== tour) : [...c.tourIds, tour] } : c)) }))
  const day = sharedDay(p.cabins)
  return (
    <Page title="route.cabins2" intro="cab.intro">
      <SharingNote field="plans" />
      <Field label={t('cab.name')} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      <Button disabled={!name.trim()} onClick={() => { set((s) => ({ ...s, cabins: [...s.cabins, { id: newMemoryId(), name: name.trim(), tourIds: [] }].slice(0, 6) })); setName('') }}>{t('cab.add')}</Button>
      {p.cabins.map((c) => (
        <Card key={c.id} labelledBy={`cab-${c.id}`}>
          <h2 id={`cab-${c.id}`} className="card__title">{c.name}</h2>
          <fieldset><legend>{t('cab.goes')}</legend>
            {EXCURSIONS.map((x) => <label key={x.id} className="choice"><input type="checkbox" checked={c.tourIds.includes(x.id)} onChange={() => toggle(c.id, x.id)} /><span>{x.name}</span></label>)}
          </fieldset>
          <Button variant="tertiary" onClick={() => set((s) => ({ ...s, cabins: s.cabins.filter((y) => y.id !== c.id) }))}>{t('poll.remove')}</Button>
        </Card>
      ))}
      {p.cabins.length > 1 && (
        <Card labelledBy="cab-day">
          <h2 id="cab-day" className="card__title">{t('cab.shared')}</h2>
          <p>{day.together.length > 0 ? day.together.join(', ') : t('cab.nothing')}</p>
          <ul className="plain-list">{day.apart.filter((a) => a.titles.length > 0).map((a) => <li key={a.id}>{t('cab.only', { cabin: a.cabin, what: a.titles.join(', ') })}</li>)}</ul>
        </Card>
      )}
    </Page>
  )
}

/** Family traditions (XG-04): a checklist that carries into the next trip with the boxes clear. */
export function TraditionsScreen() {
  const { p, set } = usePlanning()
  const [text, setText] = useState('')
  const [carried, setCarried] = useState(false)
  return (
    <Page title="route.traditions" intro="trad.intro">
      <Field label={t('trad.add')} value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
      <Button disabled={!text.trim()} onClick={() => { set((s) => ({ ...s, traditions: addTradition(s.traditions, newMemoryId(), text) })); setText('') }}>{t('trad.addButton')}</Button>
      <ul className="plain-list">
        {p.traditions.map((x) => (
          <li key={x.id}>
            <label className="choice"><input type="checkbox" checked={x.done} onChange={(e) => set((s) => ({ ...s, traditions: s.traditions.map((y) => (y.id === x.id ? { ...y, done: e.target.checked } : y)) }))} /><span>{x.text}</span></label>
            <Button variant="tertiary" onClick={() => set((s) => ({ ...s, traditions: s.traditions.filter((y) => y.id !== x.id) }))}>{t('poll.remove')}</Button>
          </li>
        ))}
      </ul>
      {p.traditions.length > 0 && <Button variant="secondary" onClick={() => { set((s) => ({ ...s, traditions: carryOver(s.traditions) })); setCarried(true) }}>{t('trad.carry')}</Button>}
      {carried && <p role="status">{t('trad.carried')}</p>}
    </Page>
  )
}
