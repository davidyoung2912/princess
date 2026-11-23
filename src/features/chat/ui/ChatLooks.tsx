import { avatarImageUrl, isAvatarId } from '../domain/chatAvatar'
import { initials } from '../domain/chatThread'
import { API_URL } from '../../../app/runtime'
import { useSettings } from '../../../shared/hooks/useSettings'
import { useMyAvatar } from '../../../shared/hooks/useMyAvatar'
import { useSyncExternalStore, type ReactNode } from 'react'
import { getContext, subscribeContext } from '../../account/logic/context'
import { t, th as heading } from '../../../shared/i18n'
import { Chip } from '../../../shared/ui/Chip'
import { requestGreeting } from '../logic/greet'

/** The round picture in a chat list: the person's chosen cartoon avatar, or their initials. Decorative: the name is always beside it. */
export function ChatAvatar({ avatar, name, small = false }: { avatar: string | undefined | null; name: string; small?: boolean }) {
  const src = isAvatarId(avatar) ? avatarImageUrl(API_URL, avatar) : null
  return (
    <span className={small ? 'conv__avatar conv__avatar--small' : 'conv__avatar'} aria-hidden="true">
      {src ? <img className="conv__avatar-img" src={src} alt="" width={small ? 28 : 44} height={small ? 28 : 44} loading="lazy" decoding="async" /> : initials(name)}
    </span>
  )
}

/** Someone else's picture in a message: tapping it starts a message to them (the box gets "Hey Name, " when empty, and takes the focus). A real button, so a keyboard reaches it too. */
export function GreetFace({ name, children }: { name: string; children: ReactNode }) {
  return <button type="button" className="greet-face" aria-label={t('chat.greet', { name })} onClick={() => requestGreeting(name)}>{children}</button>
}

/** The signed-in guest's own round picture (their chosen avatar, or their initials), for the line above their own words. */
export function MyChatAvatar({ small = false }: { small?: boolean }) {
  const avatar = useMyAvatar()
  const name = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.name ?? ''
  return <ChatAvatar avatar={avatar} name={name} small={small} />
}

/** The chat sound and buzz: off until turned on, chosen per device. (The avatar is chosen in Settings and in the welcome.) */
export function ChatLooks() {
  const [settings, update] = useSettings()
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  return (
    <section aria-labelledby="looks-h">
      <h3 id="looks-h">{heading('chatFeel.title')}</h3>
      <div className="chip-row">
        <Chip pressed={settings.chatSounds} onToggle={() => update({ chatSounds: !settings.chatSounds })}>{t('chatFeel.sound')}</Chip>
        {canVibrate && <Chip pressed={settings.chatBuzz} onToggle={() => update({ chatBuzz: !settings.chatBuzz })}>{t('chatFeel.buzz')}</Chip>}
      </div>
      <p className="muted">{t('chatFeel.body')}</p>
      {!canVibrate && <p className="muted">{t('alerts.noVibrate')}</p>}
    </section>
  )
}
