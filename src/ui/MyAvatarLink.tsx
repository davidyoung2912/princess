import { Link } from 'react-router'
import { useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { avatarImageUrl } from '../domain/chatAvatar'
import { initials } from '../domain/chatThread'
import { useMyAvatar } from '../hooks/useMyAvatar'
import { API_URL } from '../runtime'
import { t } from '../i18n'
import logo from '../assets/princess.webp'

/**
 * The guest's own picture in a round frame, in the place the app's logo used to be: it glows and grows on hover and goes to their account page. A guest who has not chosen a picture
 * sees their initials, and until the choice has been read (or with no name to show) the app's logo stands in.
 */
export function MyAvatarLink({ className }: { className: string }) {
  const avatar = useMyAvatar()
  const name = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.name ?? ''
  const src = avatarImageUrl(API_URL, avatar)
  return (
    <Link to="/account" className={`${className} me-avatar`} aria-label={t('account.logo')}>
      {avatar === undefined || (!src && !name)
        ? <img src={logo} alt="" width="512" height="512" />
        : <span className="me-avatar__pic" style={src ? { backgroundImage: `url("${src}")` } : undefined} aria-hidden="true">{src ? '' : initials(name)}</span>}
    </Link>
  )
}
