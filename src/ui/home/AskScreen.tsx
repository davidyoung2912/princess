import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { requestStanley } from '../../ai/stanleyOpen'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'

/** Suggested questions; Stanley answers them from the guest's own plan, checklist and bill. */
const EXAMPLES: readonly string[] = ['What time is dinner?', 'What is next?', 'What do I still need to do?', 'When must I be back on the ship?', 'Summarise my day']

/** Ask your cruise (XA-01, XA-02): a question box that hands every request to Stanley. A request to move, add or order something comes back in his chat as a preview, and only happens when the guest confirms. */
export function AskScreen() {
  const [params] = useSearchParams()
  // The words are filled in from the link but not sent.
  const [text, setText] = useState(() => (params.get('q') ?? '').slice(0, 200))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    requestStanley(q)
  }

  return (
    <div className="page">
      <p>{t('ask.stanley')}</p>
      <p>{t('ask.intro')}</p>
      <p className="muted">{t('ask.promise')}</p>
      <form onSubmit={submit}>
        <Field label={t('ask.label')} hint={t('ask.hint')} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        <Button type="submit">{t('ask.send')}</Button>
      </form>
      <ul className="plain-list" aria-label={t('ask.examples')}>
        {EXAMPLES.map((q) => <li key={q}><Button variant="tertiary" onClick={() => requestStanley(q)}>{q}</Button></li>)}
      </ul>
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}
