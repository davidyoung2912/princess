import { useState } from 'react'
import { avatarImageUrl, groupAvatars } from '../domain/chatAvatar'
import { optimistic } from '../data/optimistic'
import { useAction } from '../hooks/useAction'
import { useMine } from '../hooks/useMine'
import { api, API_URL } from '../runtime'
import { t, type StringKey } from '../i18n'
import { ActionError } from './account/parts'
import { Button } from './Button'

/**
 * The picture a guest chooses for chat: about 50 cartoon avatars in four groups (people, sketch people, robots, critters), each a labelled radio button with a tick on the chosen one.
 * The choice is saved as it is made (and follows the guest between devices). Used in the welcome and in Settings. Photos are never uploaded.
 */
export function AvatarPicker() {
  const catalogue = useMine(() => api.messages.avatars())
  const stored = useMine(() => api.messages.avatar())
  const [shown, setShown] = useState<string | null | undefined>(undefined)
  const [announce, setAnnounce] = useState('')
  const current = shown === undefined ? (stored.data ?? null) : shown
  const choose = useAction(async (id: string | null) => {
    await optimistic(() => setShown(id), () => api.messages.setAvatar(id), () => setShown(undefined))
    stored.retry()
    setAnnounce(t(id ? 'avatar.saved' : 'avatar.cleared'))
  })
  if (catalogue.status === 'error') return <p role="alert" className="field__error">{t('avatar.failed')}</p>
  if (!catalogue.data) return <p role="status" className="muted">{t('account.loading')}</p>
  return (
    <div className="avatar-picker">
      {groupAvatars(catalogue.data).map(({ group, choices }) => (
        <fieldset key={group} className="avatar-picker__group">
          <legend>{t(`avatar.group.${group}` as StringKey)}</legend>
          <div className="avatar-picker__grid">
            {choices.map((c) => (
              <label key={c.id} className={`avatar-picker__option${current === c.id ? ' avatar-picker__option--on' : ''}`}>
                <input type="radio" name="chat-avatar" value={c.id} checked={current === c.id} disabled={choose.busy} onChange={() => void choose.run(c.id)} />
                <img src={avatarImageUrl(API_URL, c.id) ?? ''} alt={c.label} width="64" height="64" loading="lazy" decoding="async" />
                {current === c.id && <span className="avatar-picker__tick" aria-hidden="true">✓</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p role="status" className="visually-hidden">{announce}</p>
      <ActionError error={choose.error} />
      {current && <Button variant="tertiary" disabled={choose.busy} onClick={() => void choose.run(null)}>{t('avatar.reset')}</Button>}
    </div>
  )
}
