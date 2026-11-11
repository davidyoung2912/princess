import { avatarImageUrl, isAvatarId } from '../../domain/chatAvatar'
import { initials } from '../../domain/chatThread'
import { API_URL } from '../../runtime'
import { useSettings } from '../../hooks/useSettings'
import { t, th as heading } from '../../i18n'
import { Chip } from '../Chip'

/** The round picture in a chat list: the person's chosen cartoon avatar, or their initials. Decorative: the name is always beside it. */
export function ChatAvatar({ avatar, name, small = false }: { avatar: string | undefined | null; name: string; small?: boolean }) {
  const src = isAvatarId(avatar) ? avatarImageUrl(API_URL, avatar) : null
  return (
    <span className={small ? 'conv__avatar conv__avatar--small' : 'conv__avatar'} aria-hidden="true">
      {src ? <img className="conv__avatar-img" src={src} alt="" width={small ? 28 : 44} height={small ? 28 : 44} loading="lazy" decoding="async" /> : initials(name)}
    </span>
  )
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
