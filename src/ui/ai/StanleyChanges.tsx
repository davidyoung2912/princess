import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { startVisibleInterval } from '../../hooks/visibleInterval'
import { cardExpired, expiresInMs } from '../../ai/stanleyOps'
import { normalizeAction, planSnapshot, type StanleyAction } from '../../ai/stanleyAction'
import {
  DIGEST, deliveryLevel, loadSession, normalizeDelivery, normalizeExplanation, normalizeList, recordShown, saveSession, savedParam, shownElsewhere,
  type ChangeAction, type ChangeCard, type ChangeOption, type ChangeScreen, type Delivery, type Explanation, type Missed,
} from '../../ai/stanleyChanges'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { getWatched } from '../../push/browser'
import { stanleyActions, stanleyChanges } from '../../runtime'
import { stanleyLevelFor } from '../../settings/settings'
import { Button } from '../Button'
import { Card } from '../Card'
import { StanleyActionCard } from './StanleyActionCard'

const session = (): Pick<Storage, 'getItem' | 'setItem'> | null => { try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null } }
const saved = (): string[] => [...getWatched()]

/** The change, made ready for the guest to look at and confirm. It is only prepared here: the card that comes back has its own Confirm, and nothing is done before it is pressed. */
function PreparedAction({ action }: { action: ChangeAction }) {
  const currentDay = useCurrentDay()
  const day = Number(action.args.day) >= 1 ? Number(action.args.day) : currentDay
  const dp = useDayPlan(day)
  const [prepared, setPrepared] = useState<StanleyAction | null>(null)
  const [failed, setFailed] = useState(false)
  // A day-plan change needs the plan as the phone holds it, so it waits until the plan has loaded.
  const ready = action.kind !== 'plan_change' || dp.ready
  useEffect(() => {
    if (!ready) return
    let live = true
    stanleyActions.prepare({ kind: action.kind, args: action.args, context: { plan: planSnapshot(dp.rows, dp.alternatives, day), sailingId: dp.sailing.id } })
      .then((raw) => { const a = normalizeAction(raw); if (live) { setPrepared(a); setFailed(a === null) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
    // The preview is asked for once, when the guest asked to see it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  return (
    <div role="status">
      {failed && <p>{t('ch11.prepareFailed')}</p>}
      {!failed && !prepared && <p className="muted">{t('ch11.preparing')}</p>}
      {prepared && <StanleyActionCard action={prepared} onChange={setPrepared} />}
    </div>
  )
}

function OptionView({ option }: { option: ChangeOption }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <p><strong>{option.label}</strong>{option.detail && <> {option.detail}</>}</p>
      {option.route && <p><Link to={option.route}>{t('ch11.open')}</Link></p>}
      {option.action && !open && (
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>{t('ch11.prepare')}</Button>
          <p className="muted">{t('ch11.prepareHint')}</p>
        </>
      )}
      {option.action && open && <PreparedAction action={option.action} />}
    </>
  )
}

function ExplainPanel({ card, sailingId }: { card: ChangeCard; sailingId: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [e, setE] = useState<Explanation | null>(null)
  const [failed, setFailed] = useState(false)
  const toggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (e) return
    setFailed(false)
    try { const x = normalizeExplanation(await stanleyChanges.explain(card.id, sailingId, savedParam(saved()))); setE(x); setFailed(x === null) } catch { setFailed(true) }
  }
  return (
    <>
      <Button variant="tertiary" onClick={() => void toggle()} aria-expanded={open} aria-controls={`${id}-p`}>{open ? t('ch11.hideExplain') : t('ch11.explain')}</Button>
      <div id={`${id}-p`} role="region" aria-label={t('ch11.explain')} hidden={!open}>
        {failed && <p>{t('ch11.explainFailed')}</p>}
        {e && <dl>{e.questions.map((q) => <div key={q.key}><dt><strong>{q.question}</strong></dt><dd>{q.answer}</dd></div>)}</dl>}
      </div>
    </>
  )
}

/** One change: what changed, why it affects you, what Stanley recommends and the other options, with how sure it is and where that came from. */
export function StanleyChangeCard({ card, sailingId, onDismissed }: { card: ChangeCard; sailingId: string; onDismissed?: (id: string) => void }) {
  const id = useId()
  const [failed, setFailed] = useState(false)
  const dismiss = async () => {
    setFailed(false)
    try { await stanleyChanges.dismiss(card.id, { fingerprint: card.fingerprint, sailingId }); onDismissed?.(card.id) } catch { setFailed(true) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{card.title}</h2>
      <p>
        <span className={card.critical ? 'tag tag--warn' : 'tag'}>{card.critical ? t('ch11.alertTag') : t(`ch11.consequence.${card.consequence}` as StringKey)}</span>{' '}
        <span className={card.status === 'verified' ? 'tag tag--good' : 'tag'}>{t(`ch11.status.${card.status}` as StringKey)}</span>
      </p>
      <p className="muted">{t('ch11.source', { source: card.source, time: card.sourceAtText })}</p>
      <h3>{t('ch11.what')}</h3>
      <p>{card.what}</p>
      <h3>{t('ch11.why')}</h3>
      <p>{card.why}</p>
      {card.affects.length > 0 && <p className="muted">{t('ch11.affects')}: {card.affects.map((a) => (a.time ? `${a.name} ${a.time}` : a.name)).join(', ')}.</p>}
      <h3>{t('ch11.recommended')}</h3>
      <OptionView option={card.recommended} />
      {card.others.length > 0 && (
        <>
          <h3>{t('ch11.others')}</h3>
          <ul className="plain-list">{card.others.map((o) => <li key={o.id}><OptionView option={o} /></li>)}</ul>
        </>
      )}
      <p className="muted">{t('ch11.ifNothing', { text: card.ifNothing })}</p>
      <div className="button-row">
        <ExplainPanel card={card} sailingId={sailingId} />
        <Button variant="secondary" onClick={() => void dismiss()}>{t('ch11.dismiss')}</Button>
      </div>
      <p className="muted">{t('ch11.dismissHint')}</p>
      <div role="status">{failed && <p>{t('ch11.dismissFailed')}</p>}</div>
    </Card>
  )
}

/** "What did I miss?": the changes first noticed since the guest last caught up, ranked as the list is. */
function Digest({ digest, sailingId, onDone }: { digest: Missed; sailingId: string; onDone: () => void }) {
  const id = useId()
  const done = async () => { try { await stanleyChanges.caughtUp() } catch { /* it simply shows again next time */ } onDone() }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('ch11.digest.title')}</h2>
      <p>{digest.since === null ? t('ch11.digest.first') : t('ch11.digest.since')}</p>
      <ul className="plain-list">
        {digest.cards.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong> <span className={c.status === 'verified' ? 'tag tag--good' : 'tag'}>{t(`ch11.status.${c.status}` as StringKey)}</span>
            <br />{c.what}
            <ExplainPanel card={c} sailingId={sailingId} />
          </li>
        ))}
      </ul>
      {digest.total > digest.cards.length && <p className="muted">{t('ch11.digest.more', { count: digest.total - digest.cards.length })}</p>}
      <div className="button-row">
        <Button onClick={() => void done()}>{t('ch11.digest.done')}</Button>
        <Link to="/home/updates">{t('ch11.digest.all')}</Link>
      </div>
    </Card>
  )
}

/**
 * What Stanley has to say about changes on this screen, under the delivery rules the server applies: alerts (a deadline risk, a lost booking) apart from suggestions, quiet hours, one proactive element per
 * screen, three in a session, and nothing a guest dismissed unless its facts have changed. A guest who has turned Stanley off, or who is signed out, sees nothing here. The one element on a screen stays for
 * the visit; it is not shown again on other screens.
 */
export function StanleyChanges({ screen }: { screen: ChangeScreen }) {
  const me = usePersona()
  const sailing = useSailing()
  const [settings] = useSettings()
  const level = deliveryLevel(stanleyLevelFor(settings))
  // The answer is kept with what it was asked for, so one for another screen, level or guest is never shown.
  const asked = `${me?.id ?? ''}|${sailing.id}|${screen}|${level}`
  const [loaded, setLoaded] = useState<{ asked: string; delivery: Delivery; at: number } | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!me || level === 'off') return
    let live = true
    const store = session()
    const before = loadSession(store)
    stanleyChanges.deliver({ sailingId: sailing.id, screen, level, shown: shownElsewhere(before, screen), saved: saved() })
      .then((raw) => {
        const d = normalizeDelivery(raw)
        if (!live || !d) return
        setLoaded({ asked, delivery: d, at: Date.now() })
        saveSession(store, recordShown(before, screen, d.digest ? DIGEST : d.suggestion?.id ?? null))
      })
      .catch(() => undefined)
    return () => { live = false }
  }, [me?.id, sailing.id, screen, level]) // eslint-disable-line react-hooks/exhaustive-deps
  // Stale-tip expiry (phase 14): a suggestion or tip the guest has left on the screen times out, so nothing nags. Alerts never do.
  const [now, setNow] = useState(() => Date.now())
  const shown = loaded?.delivery.suggestion
  useEffect(() => {
    if (!loaded || !shown || expiresInMs(shown, loaded.at, Date.now()) === null) return
    return startVisibleInterval(() => setNow(Date.now()), 30_000)
  }, [loaded, shown])
  const delivery = me && level !== 'off' && loaded?.asked === asked ? loaded.delivery : null
  if (!me || !delivery) return null
  const hide = (id: string) => setHidden((h) => new Set([...h, id]))
  const alerts = delivery.alerts.filter((c) => !hidden.has(c.id))
  const suggestion = delivery.suggestion && !hidden.has(delivery.suggestion.id) && !cardExpired(delivery.suggestion, loaded?.at ?? now, now) ? delivery.suggestion : null
  const digest = delivery.digest && !hidden.has(DIGEST) ? delivery.digest : null
  if (alerts.length === 0 && !suggestion && !digest) return null
  return (
    <section aria-label={t('ch11.region')} aria-live="polite">
      {alerts.map((c) => <StanleyChangeCard key={c.id} card={c} sailingId={sailing.id} onDismissed={hide} />)}
      {suggestion && <StanleyChangeCard card={suggestion} sailingId={sailing.id} onDismissed={hide} />}
      {digest && <Digest digest={digest} sailingId={sailing.id} onDone={() => hide(DIGEST)} />}
    </section>
  )
}

/** Every change on record for the trip (the Notices screen), with each one's source and how sure it is. Dismissed changes are not listed. */
export function StanleyChangeList() {
  const me = usePersona()
  const sailing = useSailing()
  const id = useId()
  const [list, setList] = useState<ReturnType<typeof normalizeList>>(null)
  const [failed, setFailed] = useState(false)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!me) return
    let live = true
    stanleyChanges.list(sailing.id, savedParam(saved()))
      .then((raw) => { const l = normalizeList(raw); if (live) { setList(l); setFailed(l === null) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [me?.id, sailing.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return null
  const cards = (list?.cards ?? []).filter((c) => !hidden.has(c.id))
  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{th('ch11.list.title')}</h2>
      <p>{t('ch11.list.intro')}</p>
      <div role="status">
        {failed && <p>{t('ch11.list.failed')}</p>}
        {list && cards.length === 0 && <p>{t('ch11.list.none', { time: list.asOfText })}</p>}
        {list && list.unread.length > 0 && <p className="muted">{t('ch11.list.unread', { sources: list.unread.join(', ') })}</p>}
      </div>
      {cards.map((c) => <StanleyChangeCard key={c.id} card={c} sailingId={sailing.id} onDismissed={(x) => setHidden((h) => new Set([...h, x]))} />)}
    </section>
  )
}

