import { useEffect, useRef } from 'react'
import { COMMON_EMOJI } from '../../domain/chatEmoji'
import { t, type StringKey } from '../../i18n'

/**
 * A small row of common emoji for a desktop composer. It is a plain group of buttons, not a modal: Escape closes it and puts focus back on the button that opened it,
 * Tab moves on as normal, and the system picker (Windows key and full stop, or Control Command Space) is named for anything not here.
 */
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  // Focus goes to the first emoji when it opens, so a keyboard user does not have to hunt for it.
  useEffect(() => { first.current?.focus() }, [])
  useEffect(() => {
    const el = box.current
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    el?.addEventListener('keydown', onKey)
    return () => el?.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="emoji-picker" ref={box} role="group" aria-label={t('emoji.title')}>
      <div className="emoji-picker__grid">
        {COMMON_EMOJI.map((e, i) => (
          <button key={e.id} ref={i === 0 ? first : undefined} type="button" className="emoji-picker__btn" aria-label={t(`emoji.${e.id}` as StringKey)} onClick={() => onPick(e.char)}>
            <span aria-hidden="true">{e.char}</span>
          </button>
        ))}
      </div>
      <p className="muted">{t('emoji.system')}</p>
    </div>
  )
}
