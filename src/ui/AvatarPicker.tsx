import { useState } from 'react'
import { AVATAR_PAGE_SIZE, avatarImageUrl, avatarPage, avatarPageCount, avatarPageOf, groupAvatars, stepAvatarPage } from '../domain/chatAvatar'
import { optimistic } from '../data/optimistic'
import { useAction } from '../hooks/useAction'
import { useMine } from '../hooks/useMine'
import { api, API_URL } from '../runtime'
import { t } from '../i18n'
import { ActionError } from './account/parts'
import { Button } from './Button'

/**
 * The picture a guest chooses for chat: about 50 cartoon avatars, shown four at a time with Previous and More buttons that wrap round (people, then sketches, robots and critters), each a labelled radio button with a tick on the chosen one.
 * The choice is saved as it is made (and follows the guest between devices). Used in the welcome and in Settings. Photos are never uploaded.
 */
export function AvatarPicker() {
  const catalogue = useMine(() => api.messages.avatars())
  const stored = useMine(() => api.messages.avatar())
  const [shown, setShown] = useState<string | null | undefined>(undefined)
  const [announce, setAnnounce] = useState('')
  const [at, setAt] = useState<number | null>(null)
  const current = shown === undefined ? (stored.data ?? null) : shown
  const choose = useAction(async (id: string | null) => {
    await optimistic(() => setShown(id), () => api.messages.setAvatar(id), () => setShown(undefined))
    stored.retry()
    setAnnounce(t(id ? 'avatar.saved' : 'avatar.cleared'))
  })
  if (catalogue.status === 'error') return <p role="alert" className="field__error">{t('avatar.failed')}</p>
  if (!catalogue.data) return <p role="status" className="muted">{t('account.loading')}</p>
  const all = groupAvatars(catalogue.data).flatMap((g) => g.choices)
  const pages = avatarPageCount(all.length)
  const page = at ?? avatarPageOf(all, current)
  const from = page * AVATAR_PAGE_SIZE + 1
  const range = t('avatar.range', { from, to: Math.min(from + AVATAR_PAGE_SIZE - 1, all.length), total: all.length })
  const go = (delta: number) => { setAt(stepAvatarPage(page, pages, delta)); setAnnounce('') }
  return (
    <div className="avatar-picker">
      <fieldset className="avatar-picker__group">
        <legend>{t('avatar.pickLegend')}</legend>
        <div className="avatar-picker__grid">
          {avatarPage(all, page).map((c) => (
            <label key={c.id} className={`avatar-picker__option${current === c.id ? ' avatar-picker__option--on' : ''}`}>
              <input type="radio" name="chat-avatar" value={c.id} checked={current === c.id} disabled={choose.busy} onChange={() => void choose.run(c.id)} />
              <img src={avatarImageUrl(API_URL, c.id) ?? ''} alt={c.label} width="64" height="64" decoding="async" />
              {current === c.id && <span className="avatar-picker__tick" aria-hidden="true">✓</span>}
            </label>
          ))}
        </div>
      </fieldset>
      {pages > 1 && (
        <div className="avatar-picker__pager">
          <Button variant="secondary" onClick={() => go(-1)}>{t('avatar.prev')}</Button>
          <span className="muted" role="status">{range}</span>
          <Button variant="secondary" onClick={() => go(1)}>{t('avatar.next')}</Button>
        </div>
      )}
      <p role="status" className="visually-hidden">{announce}</p>
      <ActionError error={choose.error} />
      {current && <Button variant="tertiary" disabled={choose.busy} onClick={() => void choose.run(null)}>{t('avatar.reset')}</Button>}
    </div>
  )
}
