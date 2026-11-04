import { useState } from 'react'
import { Link } from 'react-router'
import { formatDate } from '../../domain/cruise'
import { contactProblem, CONTACT_NAME_MAX, CONTACT_NOTE_MAX, memoryBook, NOTE_MAX, nextTripText, REFLECTION_MAX, reflectionProblem, sailAgainGroup, seedNextTrip, sharedReflections, TOPIC_LABEL, TOPICS, isTopic, bookText, type Topic } from '../../domain/memoryBook'
import { categoryById, type CategoryId } from '../../domain/ship'
import { FARES } from '../../domain/fares'
import { entriesFor } from '../../domain/tripDiary'
import { itinerary } from '../../domain/sailings'

import { ADD_ONS } from '../../domain/packages'
import { packageHindsight } from '../../domain/wrapped'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useRecapData } from '../../hooks/useRecapData'
import { friendReplyFeed } from '../../feeds/friend'
import { t, th, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { BackLink } from '../onboard/common'
import { Load } from './parts'
import { BookPagePictures, DayPictureEditor } from './BookPictures'
import { useMyMedia } from '../../hooks/useMedia'
import { partyPeople } from '../../account/context'
import { StanleyStoryteller } from '../ai/StanleyStoryteller'
import { Keepsakes } from '../delights/Exports'
import { StubsCard } from '../delights/EmbarkDelights'
import { FavouritesRanked, PostcardWriter, SailedMap, WantNext } from '../delights/RememberDelights'
import { StanleyMoment } from '../ai/StanleyMoment'
import { useClockMoment } from '../../hooks/useClockMoments'

const stateroomCategory = (stateroom: string | undefined): CategoryId => (!stateroom ? 'balcony' : /suite/i.test(stateroom) ? 'miniSuite' : /balcony/i.test(stateroom) ? 'balcony' : /ocean/i.test(stateroom) ? 'oceanview' : 'interior')

async function send(text: string, title: string): Promise<'shared' | 'copied' | 'failed' | null> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared' }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}

/** The memory loop (S8-02, S8-03, S8-05, S8-06): a journal that becomes a printable book, what I would change, a seeded next trip, and people met on board. */
export function MemoryScreen() {
  const sailing = useSailing()
  const now = useNow()
  const { state, me, update } = useMemory()
  const recap = useRecapData()
  const home = useClockMoment('home')
  const pictures = useMyMedia('book')
  const [topic, setTopic] = useState<Topic>('cabin')
  /** Asks the server how a friend answered; the contact was added with the guest's consent, and nothing changes if no answer comes. */
  const hear = async (id: string, name: string) => {
    await friendReplyFeed.load(name)
    const reply = friendReplyFeed.now(name)
    if (reply) update((s) => ({ ...s, contacts: s.contacts.map((x) => (x.id === id ? { ...x, reply } : x)) }))
  }
  const [text, setText] = useState('')
  const [shareIt, setShareIt] = useState(false)
  const [reflectErr, setReflectErr] = useState<string | null>(null)
  const [includeChange, setIncludeChange] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [contactErr, setContactErr] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const days = itinerary(sailing)
  const lastDay = days[days.length - 1].date

  const addReflection = () => {
    const p = reflectionProblem(topic, text, state.reflections)
    if (p) { setReflectErr(t(`memory.err.${p}` as StringKey)); return }
    setReflectErr(null)
    update((s) => ({ ...s, reflections: [...s.reflections, { id: newMemoryId(), topic, text: text.trim(), shared: shareIt }] }))
    setText('')
    setShareIt(false)
  }

  const addContact = () => {
    const p = contactProblem(name, note, consent, state.contacts, state.blocked)
    if (p) { setContactErr(t(`memory.contactErr.${p}` as StringKey)); return }
    setContactErr(null)
    const clean = name.trim()
    update((s) => ({ ...s, contacts: [...s.contacts, { id: newMemoryId(), name: clean, note: note.trim(), consent: true, reply: 'waiting', at: now }] }))
    setName(''); setNote(''); setConsent(false)
  }

  return (
    <div className="page">
      {home && <StanleyMoment id="home" subject={sailing.id} />}
      <p>{t('memory.intro')}</p>

      <StubsCard />
      <SailedMap />
      <FavouritesRanked />
      <Card labelledBy="mem-diary">
        <h2 id="mem-diary" className="card__title">{th('diary.title')}</h2>
        <p>{t('diary.screenBody')}</p>
        <LinkButton to="/me/diary" variant="secondary">{t('diary.open')}</LinkButton>
      </Card>
      <StanleyStoryteller days={days} journal={state.journal} diary={entriesFor(state.diary, sailing.id)} onSave={(journal) => update((s) => ({ ...s, journal }))} />
      <Card labelledBy="mem-journal" >
        <h2 id="mem-journal" className="card__title no-print">{th('memory.journal')}</h2>
        <div className="no-print">
          <p>{t('memory.journalBody')}</p>
          <p className="muted">{t('media.book.note')}</p>
          {pictures.failed && <p className="muted">{t('media.book.offline')}</p>}
          <DayPictureEditor day="cover" list={pictures.list} onChange={pictures.reload} />
          {days.map((d) => (
            <div key={d.day}>
              <TextArea label={t('memory.dayNote', { day: d.day, date: formatDate(d.date) })} value={state.journal[d.day] ?? ''} maxLength={NOTE_MAX} onChange={(e) => update((s) => ({ ...s, journal: { ...s.journal, [d.day]: e.target.value } }))} />
              <DayPictureEditor day={d.day} list={pictures.list} onChange={pictures.reload} />
            </div>
          ))}
        </div>
      </Card>

      <Load state={recap}>
        {(r) => {
          const hind = state.use.paid > 0 ? packageHindsight({ paid: state.use.paid, drinks: state.use.drinks, specialtyDinners: state.use.dinners, wifiNights: state.use.wifiNights, wifiNight: ADD_ONS.wifi.base, otherFarePaid: null }) : null
          const category = stateroomCategory(me?.stateroom)
          const fare = me && me.package !== 'none' ? me.package : 'standard'
          const next = seedNextTrip({ sailing, category, fare, guests: me ? partyPeople(me.id).length : 2, tourNames: r.tourNames, favouriteMeal: r.favouriteMeal?.name ?? null, hindsight: hind, reflections: state.reflections, lastDay })
          const sections = memoryBook(sailing, r, state.journal, state.reflections, includeChange, entriesFor(state.diary, sailing.id))
          const group = sailAgainGroup(state.contacts, next)
          return (
            <>
              <Card labelledBy="mem-book">
                <h2 id="mem-book" className="card__title">{th('memory.book')}</h2>
                <p className="no-print">{t('memory.bookBody')}</p>
                <label className="choice no-print"><input type="checkbox" checked={includeChange} onChange={(e) => setIncludeChange(e.target.checked)} /><span>{t('memory.bookChange')}</span></label>
                <div className="memory-book">
                  {sections.map((s) => (
                    <div key={s.id} className="memory-book__page">
                      <h3>{s.heading}</h3>
                      {s.lines.map((l, i) => <p key={`${s.id}-${i}`}>{l}</p>)}
                      {s.id === 'title' && <BookPagePictures day="cover" list={pictures.list} />}
                      {s.id.startsWith('day-') && <BookPagePictures day={Number(s.id.slice(4))} list={pictures.list} />}
                    </div>
                  ))}
                </div>
                <div className="actions no-print">
                  <Button onClick={() => window.print()}>{t('memory.print')}</Button>
                  <Button variant="secondary" onClick={() => void send(bookText(sections), r.title).then((x) => setStatus(x))}>{t('memory.copyBook')}</Button>
                </div>
                <p className="muted no-print">{t('memory.bookNote')}</p>
                {status && <p role="status" className="no-print">{t(`recap.shared.${status}` as StringKey)}</p>}
              </Card>

              <Keepsakes names={me ? partyPeople(me.id).map((p) => p.firstName) : []} ports={r.ports} seaDays={r.seaDays} nauticalMiles={r.nauticalMiles} dinners={r.dinnerVenues} tours={r.tourNames} />

              <PostcardWriter />
              <WantNext />

              <Card labelledBy="mem-next">
                <h2 id="mem-next" className="card__title no-print">{th('memory.next')}</h2>
                <div className="no-print">
                  {next ? (
                    <>
                      <p><strong>{t('memory.nextDraft', { date: formatDate(next.departure) })}</strong></p>
                      <p>{categoryById(next.category)?.name} · {FARES[next.fare].name} · {t('memory.guests', { count: next.guests })}</p>
                      <ul className="plain-bullets">{[...next.repeat, ...next.lessons].map((l) => <li key={l}>{l}</li>)}</ul>
                      <p className="muted">{t('memory.nextNote')}</p>
                      <div className="actions">
                        <LinkButton to="/home/sailings">{t('memory.nextLook')}</LinkButton>
                        <Button variant="secondary" onClick={() => void send(nextTripText(next), t('memory.next')).then((x) => setStatus(x))}>{t('memory.nextShare')}</Button>
                      </div>
                    </>
                  ) : <p>{t('memory.nextNone')}</p>}
                </div>
              </Card>

              <Card labelledBy="mem-contacts">
                <h2 id="mem-contacts" className="card__title no-print">{th('memory.contacts')}</h2>
                <div className="no-print">
                  <p>{t('memory.contactsBody')}</p>
                  <ul className="plain-list">
                    {state.contacts.map((c) => (
                      <li key={c.id}>
                        <strong>{c.name}</strong>{c.note && ` · ${c.note}`} · {t(`memory.reply.${c.reply}` as StringKey)}
                        {c.reply === 'waiting' && <Button variant="tertiary" onClick={() => void hear(c.id, c.name)}>{t('memory.simulate')}</Button>}
                        <Button variant="tertiary" onClick={() => update((s) => ({ ...s, contacts: s.contacts.filter((x) => x.id !== c.id) }))}>{t('memory.remove')}</Button>
                        <Button variant="tertiary" onClick={() => update((s) => ({ ...s, contacts: s.contacts.filter((x) => x.id !== c.id), blocked: [...s.blocked, c.name] }))}>{t('memory.block')}</Button>
                      </li>
                    ))}
                  </ul>
                  {group.length > 0 && <p><strong>{t('memory.group', { names: group.join(', ') })}</strong></p>}
                  <Field label={t('memory.contactName')} value={name} maxLength={CONTACT_NAME_MAX} onChange={(e) => setName(e.target.value)} />
                  <Field label={t('memory.contactNote')} hint={t('memory.contactNoteHint')} value={note} maxLength={CONTACT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
                  <label className="choice"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t('memory.contactConsent')}</span></label>
                  {contactErr && <p role="alert" className="field__error">{contactErr}</p>}
                  <Button variant="secondary" onClick={addContact}>{t('memory.contactAdd')}</Button>
                  <p className="muted">{t('memory.contactsNote')} <Link to="/me/report-problem">{t('memory.report')}</Link></p>
                  {state.blocked.length > 0 && <p className="muted">{t('memory.blocked', { names: state.blocked.join(', ') })} <Button variant="tertiary" onClick={() => update((s) => ({ ...s, blocked: [] }))}>{t('memory.unblock')}</Button></p>}
                </div>
              </Card>
            </>
          )
        }}
      </Load>

      <Card labelledBy="mem-change">
        <h2 id="mem-change" className="card__title no-print">{th('memory.change')}</h2>
        <div className="no-print">
          <p>{t('memory.changeBody')}</p>
          <ul className="plain-list">
            {state.reflections.map((r) => (
              <li key={r.id}>
                <strong>{TOPIC_LABEL[r.topic]}</strong>: {r.text} <span className="muted">({r.shared ? t('memory.sharedYes') : t('memory.sharedNo')})</span>
                <Button variant="tertiary" onClick={() => update((s) => ({ ...s, reflections: s.reflections.filter((x) => x.id !== r.id) }))}>{t('memory.remove')}</Button>
              </li>
            ))}
          </ul>
          <div className="field">
            <label htmlFor="mem-topic">{t('memory.topic')}</label>
            <select id="mem-topic" value={topic} onChange={(e) => { if (isTopic(e.target.value)) setTopic(e.target.value) }}>
              {TOPICS.map((k) => <option key={k} value={k}>{TOPIC_LABEL[k]}</option>)}
            </select>
          </div>
          <TextArea label={t('memory.changeText')} value={text} maxLength={REFLECTION_MAX} onChange={(e) => setText(e.target.value)} />
          <label className="choice"><input type="checkbox" checked={shareIt} onChange={(e) => setShareIt(e.target.checked)} /><span>{t('memory.changeShare')}</span></label>
          {reflectErr && <p role="alert" className="field__error">{reflectErr}</p>}
          <div className="actions">
            <Button variant="secondary" onClick={addReflection}>{t('memory.changeAdd')}</Button>
            {state.reflections.some((r) => r.shared) && <Button variant="tertiary" onClick={() => void send(sharedReflections(state.reflections), t('memory.change')).then((x) => setStatus(x))}>{t('memory.changeSend')}</Button>}
          </div>
          <p className="muted">{t('memory.changePrivate')}</p>
        </div>
      </Card>

      <p className="no-print"><Link to="/me/wrapped">{t('route.wrapped')}</Link> · <Link to="/me/rebook">{t('route.rebook')}</Link> · <Link to="/me/loyalty">{t('route.loyalty')}</Link> · <Link to="/me/privacy">{t('route.privacy')}</Link></p>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
