import { useEffect, useRef, useState } from 'react'
import { AVATAR_PAGE_SIZE, avatarImageUrl, avatarPage, avatarPageCount, avatarPageOf, groupAvatars, stepAvatarPage } from '../../features/chat/domain/chatAvatar'
import { optimistic } from '../data/optimistic'
import { useAction } from '../hooks/useAction'
import { useMine } from '../hooks/useMine'
import { setMyAvatar } from '../hooks/useMyAvatar'
import { api, API_URL } from '../../app/runtime'
import { t, type StringKey } from '../i18n'
import { ActionError } from '../../features/account/ui/parts'
import { Button } from './Button'
import { ChevronLeft, ChevronRight, Undo } from './icons'

/**
 * The picture a guest chooses for chat: a couple of hundred cartoon avatars (people, sketches, robots, critters, pixel people and abstract patterns), shown two lines at a time with arrows at each side that wrap round, each a labelled radio button with a tick on the chosen one.
 * One checkbox per kind narrows the list by kind (all on to start; the last one cannot be switched off). They only change what is shown; the chosen picture stays chosen.
 * The choice is saved as it is made (and follows the guest between devices). Used in the welcome and in Settings. Photos are never uploaded.
 */
/** Lines of pictures shown at a time. */
const ROWS = 2

export function AvatarPicker() {
  const catalogue = useMine(() => api.messages.avatars())
  const stored = useMine(() => api.messages.avatar())
  const [shown, setShown] = useState<string | null | undefined>(undefined)
  const [announce, setAnnounce] = useState('')
  const [at, setAt] = useState<number | null>(null)
  const [hidden, setHidden] = useState<readonly string[]>([])
  // How many pictures fit on the two lines the grid draws: as many per line as the width allows, so a wide screen shows more at a time.
  const grid = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<number>(AVATAR_PAGE_SIZE * ROWS)
  const ready = !!catalogue.data
  useEffect(() => {
    const el = grid.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 8
      const cell = parseFloat(getComputedStyle(document.documentElement).fontSize) * 4.5
      setSize(Math.max(AVATAR_PAGE_SIZE, Math.floor((el.clientWidth + gap) / (cell + gap))) * ROWS)
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [ready])
  const current = shown === undefined ? (stored.data ?? null) : shown
  const choose = useAction(async (id: string | null) => {
    await optimistic(() => setShown(id), () => api.messages.setAvatar(id), () => setShown(undefined))
    setMyAvatar(id)
    stored.retry()
    setAnnounce(t(id ? 'avatar.saved' : 'avatar.cleared'))
  })
  if (catalogue.status === 'error') return <p role="alert" className="field__error">{t('avatar.failed')}</p>
  if (!catalogue.data) return <p role="status" className="muted">{t('account.loading')}</p>
  const groups = groupAvatars(catalogue.data)
  const all = groups.filter((g) => !hidden.includes(g.group)).flatMap((g) => g.choices)
  const toggle = (group: string, on: boolean) => { setHidden((h) => (on ? h.filter((x) => x !== group) : [...h, group])); setAt(0); setAnnounce('') }
  const pages = avatarPageCount(all.length, size)
  const page = Math.min(at ?? avatarPageOf(all, current, size), pages - 1)
  const go = (delta: number) => { setAt(stepAvatarPage(page, pages, delta)); setAnnounce('') }
  return (
    <div className="avatar-picker">
      <fieldset className="avatar-picker__group">
        <legend>{t('avatar.pickLegend')}</legend>
        {groups.length > 1 && (
          <div className="avatar-picker__filter" role="group" aria-label={t('avatar.filter')}>
            {groups.map((g) => {
              const on = !hidden.includes(g.group)
              return (
                <label key={g.group} className="choice avatar-picker__filter-item">
                  <input type="checkbox" checked={on} disabled={on && groups.length - hidden.length === 1} onChange={(e) => toggle(g.group, e.target.checked)} />
                  <span>{t(`avatar.group.${g.group}` as StringKey)}</span>
                </label>
              )
            })}
          </div>
        )}
        <div className="avatar-picker__row">
          {pages > 1 && <button type="button" className="avatar-picker__arrow" aria-label={t('avatar.prev')} onClick={() => go(-1)}><ChevronLeft aria-hidden="true" /></button>}
          <div className="avatar-picker__grid" ref={grid}>
            {avatarPage(all, page, size).map((c) => (
              <label key={c.id} className={`avatar-picker__option${current === c.id ? ' avatar-picker__option--on' : ''}`}>
                <input type="radio" name="chat-avatar" value={c.id} checked={current === c.id} disabled={choose.busy} onChange={() => void choose.run(c.id)} />
                <img src={avatarImageUrl(API_URL, c.id) ?? ''} alt={c.label} width="64" height="64" decoding="async" />
                {current === c.id && <span className="avatar-picker__tick" aria-hidden="true">✓</span>}
              </label>
            ))}
          </div>
          {pages > 1 && <button type="button" className="avatar-picker__arrow" aria-label={t('avatar.next')} onClick={() => go(1)}><ChevronRight aria-hidden="true" /></button>}
        </div>
      </fieldset>
      <p role="status" className="visually-hidden">{announce}</p>
      <ActionError error={choose.error} />
      {current && <Button variant="secondary" icon={Undo} className="avatar-picker__reset" disabled={choose.busy} onClick={() => void choose.run(null)}>{t('avatar.reset')}</Button>}
    </div>
  )
}
