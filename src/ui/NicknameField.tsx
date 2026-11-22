import { useEffect, useState, type FormEvent } from 'react'
import { MAX_NICKNAME, nicknameFits, tidyNickname } from '../domain/nickname'
import { useAction } from '../hooks/useAction'
import { useMine } from '../hooks/useMine'
import { t } from '../i18n'
import { api } from '../runtime'
import { ActionError } from './account/parts'
import { Button } from './Button'
import { Field } from './Field'

/** The optional chat nickname: shown in every chat when set, otherwise the username shows. Saved with its own button so a half-typed name is never sent. */
export function NicknameField() {
  const stored = useMine(() => api.chatConnections.settings())
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [problem, setProblem] = useState(false)
  useEffect(() => { if (stored.data) setText(stored.data.nickname) }, [stored.data])
  const save = useAction((n: string) => api.chatConnections.saveNickname(n))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const fits = nicknameFits(text)
    setProblem(!fits)
    if (!fits) return
    const done = await save.run(tidyNickname(text))
    if (done) { setText(done.nickname); setSaved(true) }
  }
  if (!stored.data) return null
  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <Field label={t('nickname.label')} hint={t('nickname.hint')} value={text} maxLength={MAX_NICKNAME} onChange={(e) => { setText(e.target.value); setSaved(false) }} autoComplete="nickname" error={problem || save.error?.code === 'invalid' ? t('nickname.problem') : undefined} />
      {save.error?.code !== 'invalid' && <ActionError error={save.error} />}
      <div className="button-row">
        <Button type="submit" variant="secondary" disabled={save.busy}>{save.busy ? t('account.saving') : t('nickname.save')}</Button>
      </div>
      {saved && <p role="status">{t('nickname.saved')}</p>}
    </form>
  )
}
