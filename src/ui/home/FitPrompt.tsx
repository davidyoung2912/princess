import { useState, useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../../account/context'
import { demoNow } from '../../demo/store'
import { nextQuestion } from '../../guide/fit'
import { getFit, saveFit, saveOneFit, subscribeFit } from '../../guide/fitStore'
import { refreshGuide } from '../../guide/refresh'
import type { JourneyStage } from '../../routes/hubs'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

const ASKS = ['firstCruise', 'solo', 'quiet'] as const

/**
 * Stanley's one question: at the stage where an answer first matters, asks the next unanswered of the three ("Is this your first cruise?") with Yes and No, and reads the plan again.
 * Nothing is asked up front, and one question at a time. Both answers count as answered, so it is asked once.
 */
export function FitQuestion({ stage }: { stage: JourneyStage }) {
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const fit = useSyncExternalStore(subscribeFit, () => getFit(personId), () => getFit(personId))
  const [said, setSaid] = useState('')
  const key = nextQuestion(fit, stage)
  const answer = (value: boolean): void => {
    if (!key) return
    saveOneFit(personId, key, value, demoNow())
    setSaid(t('guide.fit.saved'))
    void refreshGuide()
  }
  return (
    <>
      <p className="visually-hidden" role="status" aria-live="polite">{said}</p>
      {key && (
        <Card info labelledBy="guide-ask-h">
          <h2 id="guide-ask-h" className="card__title">{t(`guide.ask.${key}`)}</h2>
          <p className="muted">{t('guide.ask.why')}</p>
          <div className="button-row">
            <Button onClick={() => answer(true)}>{t('guide.ask.yes')}</Button>
            <Button variant="secondary" onClick={() => answer(false)}>{t('guide.ask.no')}</Button>
          </div>
        </Card>
      )}
    </>
  )
}

/**
 * "Make this plan fit me": three yes-or-no answers, asked once in Dream and Discover and changeable after. They only reorder and add tasks, and hold nothing about health or access.
 * Each answer is a toggle button (pressed or not); one more tap saves, and the plan is read again.
 */
export function FitPrompt() {
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const fit = useSyncExternalStore(subscribeFit, () => getFit(personId), () => getFit(personId))
    const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ firstCruise: !!fit.firstCruise, solo: !!fit.solo, quiet: !!fit.quiet })
  const [said, setSaid] = useState('')
  const save = (answers: typeof draft): void => {
    saveFit(personId, answers, demoNow())
    setOpen(false)
    setSaid(t('guide.fit.saved'))
    void refreshGuide()
  }
  const live = <p className="visually-hidden" role="status" aria-live="polite">{said}</p>
  if (!open) return <>{live}<p><Button variant="tertiary" onClick={() => { setDraft({ firstCruise: !!fit.firstCruise, solo: !!fit.solo, quiet: !!fit.quiet }); setOpen(true) }}>{t('guide.fit.change')}</Button></p></>
  return (
    <>
      {live}
      <Card info labelledBy="guide-fit-h">
        <h2 id="guide-fit-h" className="card__title">{t('guide.fit.title')}</h2>
        <p>{t('guide.fit.intro')}</p>
        <div className="button-row">
          {ASKS.map((k) => (
            <Button key={k} variant={draft[k] ? 'primary' : 'secondary'} aria-pressed={draft[k]} onClick={() => setDraft({ ...draft, [k]: !draft[k] })}>{t(`guide.fit.${k}`)}</Button>
          ))}
        </div>
        <div className="button-row">
          <Button onClick={() => save(draft)}>{t('guide.fit.save')}</Button>
                  </div>
      </Card>
    </>
  )
}
