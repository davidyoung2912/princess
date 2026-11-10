import { useState } from 'react'
import { AVATAR_COLOURS, AVATAR_ICONS, avatarFace, avatarText, DEFAULT_AVATAR, parseAvatar, type Avatar } from '../../domain/chatAvatar'
import { initials } from '../../domain/chatThread'
import { optimistic } from '../../data/optimistic'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useSettings } from '../../hooks/useSettings'
import { api } from '../../runtime'
import { t, th as heading, type StringKey } from '../../i18n'
import { ActionError } from '../account/parts'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { usePersona } from '../../hooks/useDemo'

/** The round picture in a chat list: the person's chosen colour and ship icon, or their initials. Decorative: the name is always beside it. */
export function ChatAvatar({ avatar, name }: { avatar: string | undefined | null; name: string }) {
  const a = parseAvatar(avatar)
  return <span className="conv__avatar" data-avatar={a?.colour ?? 'default'} aria-hidden="true">{avatarFace(a, initials(name))}</span>
}

/** Your own avatar (a colour and an icon, never a photo), and the chat sound and buzz, which are off until you turn them on and are chosen per device. */
export function ChatLooks() {
  const me = usePersona()
  const stored = useMine(() => api.messages.avatar())
  const [shown, setShown] = useState<string | null | undefined>(undefined)
  const current = parseAvatar(shown === undefined ? stored.data : shown) ?? DEFAULT_AVATAR
  const [settings, update] = useSettings()
  const [announce, setAnnounce] = useState('')
  const save = useAction(async (next: Avatar) => {
    await optimistic(() => setShown(avatarText(next)), () => api.messages.setAvatar(avatarText(next)), () => setShown(undefined))
    stored.retry()
    setAnnounce(t('avatar.saved'))
  })
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  const name = me?.name ?? ''
  return (
    <section aria-labelledby="looks-h">
      <h3 id="looks-h">{heading('avatar.title')}</h3>
      <p className="avatar-preview"><span className="conv__avatar" data-avatar={current.colour} aria-hidden="true">{avatarFace(current, initials(name))}</span> <span className="muted">{t('avatar.body')}</span></p>
      <fieldset className="avatar-pick">
        <legend>{t('avatar.colour')}</legend>
        {AVATAR_COLOURS.map((c) => (
          <label key={c} className="avatar-pick__option">
            <input type="radio" name="avatar-colour" value={c} checked={current.colour === c} disabled={save.busy} onChange={() => void save.run({ ...current, colour: c })} /> {t(`avatar.colour.${c}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <fieldset className="avatar-pick">
        <legend>{t('avatar.icon')}</legend>
        {AVATAR_ICONS.map((i) => (
          <label key={i} className="avatar-pick__option">
            <input type="radio" name="avatar-icon" value={i} checked={current.icon === i} disabled={save.busy} onChange={() => void save.run({ ...current, icon: i })} /> {t(`avatar.icon.${i}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <p role="status" className="visually-hidden">{announce}</p>
      <ActionError error={save.error} />
      {shown !== undefined && shown !== null && <Button variant="tertiary" disabled={save.busy} onClick={() => void save.run(DEFAULT_AVATAR)}>{t('avatar.reset')}</Button>}
      <h3>{heading('chatFeel.title')}</h3>
      <div className="chip-row">
        <Chip pressed={settings.chatSounds} onToggle={() => update({ chatSounds: !settings.chatSounds })}>{t('chatFeel.sound')}</Chip>
        {canVibrate && <Chip pressed={settings.chatBuzz} onToggle={() => update({ chatBuzz: !settings.chatBuzz })}>{t('chatFeel.buzz')}</Chip>}
      </div>
      <p className="muted">{t('chatFeel.body')}</p>
      {!canVibrate && <p className="muted">{t('alerts.noVibrate')}</p>}
    </section>
  )
}
