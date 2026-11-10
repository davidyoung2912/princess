import { useState } from 'react'
import { normalizePoll, normalizePolls, pollResultText, POLL_ANSWERS, POLL_DAYS, splitChoices, takesAnswers, type ServerPoll } from '../../ai/stanleyPolls'
import { stanleyPolls } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { ActionError } from '../account/parts'
import { LoadError } from '../discover/parts'

/**
 * The group polls the server keeps for this booking, including ones Stanley or a helper prepared and the guest confirmed. Everyone adult on the booking answers from their own phone; only the maker may close,
 * extend or remove a poll. Totals only: nobody sees another person's answer, and silence is never counted as a yes.
 */
export function StanleyPollsCard({ initialQuestion = '' }: { initialQuestion?: string }) {
  const list = useMine(async () => normalizePolls(await stanleyPolls.list()))
  const [changed, setChanged] = useState<Record<string, ServerPoll | null>>({})
  const rows = (list.data ?? []).flatMap((p) => (p.id in changed ? changed[p.id] ?? [] : p))
  const added = Object.values(changed).filter((p): p is ServerPoll => p !== null && !(list.data ?? []).some((x) => x.id === p.id))
  const all = [...added, ...rows]
  const put = (p: ServerPoll | null, id: string) => setChanged((c) => ({ ...c, [id]: p }))
  return (
    <Card labelledBy="srv-polls-h">
      <h2 id="srv-polls-h" className="card__title">{th('spoll.title')}</h2>
      <p>{t('spoll.intro')}</p>
      <NewPoll initialQuestion={initialQuestion} onMade={(p) => put(p, p.id)} />
      {list.status === 'error' && <LoadError retry={list.retry} />}
      {list.status === 'ready' && all.length === 0 && <p className="muted">{t('spoll.none')}</p>}
      <ul className="plain-list">{all.map((p) => <li key={p.id}><PollRow poll={p} onChange={(n) => put(n, p.id)} /></li>)}</ul>
    </Card>
  )
}

function NewPoll({ initialQuestion, onMade }: { initialQuestion: string; onMade: (p: ServerPoll) => void }) {
  const [question, setQuestion] = useState(initialQuestion)
  const [options, setOptions] = useState('')
  const [days, setDays] = useState<number>(3)
  const make = useAction(async () => normalizePoll(await stanleyPolls.create({ question: question.trim(), options: splitChoices(options), days })))
  const bad = make.error?.code === 'invalid'
  const go = async () => {
    const p = await make.run()
    if (p) { onMade(p); setQuestion(''); setOptions('') }
  }
  return (
    <fieldset className="plain-fieldset">
      <legend>{t('spoll.new')}</legend>
      <Field label={t('spoll.question')} value={question} maxLength={120} onChange={(e) => setQuestion(e.target.value)} />
      <Field label={t('spoll.options')} hint={t('poll.optionsHint')} value={options} maxLength={300} onChange={(e) => setOptions(e.target.value)} error={bad ? t('poll.problem') : undefined} />
      <label>{t('spoll.days')}{' '}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{POLL_DAYS.map((d) => <option key={d} value={d}>{t('poll9.closes.days', { count: d })}</option>)}</select>
      </label>
      {make.error?.code === 'conflict' && <p role="alert" className="field__error">{t('spoll.tooMany')}</p>}
      {!bad && make.error?.code !== 'conflict' && <ActionError error={make.error} />}
      <Button disabled={make.busy || question.trim() === '' || splitChoices(options).length < 2} onClick={() => void go()}>{t('spoll.create')}</Button>
    </fieldset>
  )
}

function PollRow({ poll, onChange }: { poll: ServerPoll; onChange: (p: ServerPoll | null) => void }) {
  const now = useNow()
  const open = takesAnswers(poll, now)
  const answer = useAction(async (optionId: string, mark: string) => normalizePoll(await stanleyPolls.answer(poll.id, optionId, mark)))
  const control = useAction(async (action: 'close' | 'extend') => normalizePoll(await stanleyPolls.control(poll.id, action)))
  const remove = useAction(async () => { await stanleyPolls.remove(poll.id); return true })
  const mark = async (optionId: string, m: string) => { const p = await answer.run(optionId, m); if (p) onChange(p) }
  const run = async (action: 'close' | 'extend') => { const p = await control.run(action); if (p) onChange(p) }
  const [shared, setShared] = useState<boolean | null>(null)
  const exportIt = async () => {
    try { await navigator.clipboard.writeText(pollResultText(poll, (l, y, m, n) => t('spoll.exportLine', { label: l, yes: y, maybe: m, no: n }))); setShared(true) } catch { setShared(false) }
  }
  const drop = async () => { if (await remove.run()) onChange(null) }
  const s = poll.status
  return (
    <section aria-labelledby={`sp-${poll.id}`}>
      <h3 id={`sp-${poll.id}`}>{poll.question}</h3>
      <p className="muted">{t('spoll.by', { name: poll.owner || '?' })} · {t(`group9.state.${s.state}` as StringKey)} · {t('group9.counts', { answered: s.answered, silent: s.silent })}</p>
      <ul className="plain-list">
        {poll.options.map((o) => {
          const tally = s.tally.find((x) => x.id === o.id)
          return (
            <li key={o.id}>
              <span>{o.label}</span>{' '}
              <span className="muted">{t('spoll.tally', { yes: tally?.yes ?? 0, maybe: tally?.maybe ?? 0, no: tally?.no ?? 0 })}</span>
              <div className="button-row">
                {POLL_ANSWERS.map((m) => (
                  <Button key={m} variant={poll.myAnswers[o.id] === m ? 'primary' : 'tertiary'} aria-pressed={poll.myAnswers[o.id] === m} disabled={!open || answer.busy} onClick={() => void mark(o.id, m)}>
                    {t(`poll9.${m}` as StringKey)}{' '}<span className="visually-hidden">{o.label}</span>
                  </Button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <p role="status">{s.suggestion.text}</p>
      {poll.closesAt !== null && !poll.closed && <p className="muted">{open ? t('poll9.closesAt', { when: new Date(poll.closesAt).toLocaleString() }) : t('poll9.expired')}</p>}
      {poll.closed && <p className="muted">{t('poll.closed')}</p>}
      {answer.error?.code === 'conflict' ? <p role="alert" className="field__error">{t('spoll.closedNow')}</p> : <ActionError error={answer.error} />}
      <ActionError error={control.error} />
      <ActionError error={remove.error} />
      <div className="button-row">
        {!open && <Button variant="secondary" onClick={() => void exportIt()}>{t('spoll.export')}<span className="visually-hidden"> {poll.question}</span></Button>}
        {shared !== null && <span role="status">{shared ? t('spoll.exported') : t('spoll.exportFailed')}</span>}
      </div>
      {poll.mine && (
        <div className="button-row">
          {!poll.closed && <Button variant="secondary" disabled={control.busy} onClick={() => void run('close')}>{t('poll.close')}<span className="visually-hidden"> {poll.question}</span></Button>}
          <Button variant="secondary" disabled={control.busy} onClick={() => void run('extend')}>{t('poll9.extend')}<span className="visually-hidden"> {poll.question}</span></Button>
          <Button variant="tertiary" disabled={remove.busy} onClick={() => void drop()}>{t('poll.remove')}<span className="visually-hidden"> {poll.question}</span></Button>
        </div>
      )}
    </section>
  )
}
