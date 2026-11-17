import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ChatConversation } from '../../api/chatTypes'
import { openHuddles, type HuddleOffer } from '../../domain/chatHuddle'
import { useAction } from '../../hooks/useAction'
import { api } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'

/**
 * "Plan this with someone": adds a public card (a sailing, a port or a fare comparison) to one of the guest's open trip huddles. The offer holds catalogue facts only; the server
 * refuses anything that names personal money. With no huddle yet it points to the chat list, where one is started.
 */
export function AddToHuddle({ offer }: { offer: HuddleOffer }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ChatConversation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState('')
  const asked = useRef(false)
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    api.chatConversations.list().then((l) => setRows(openHuddles(l)), () => { asked.current = false; setFailed(true) })
  }, [open])
  const add = useAction(async (c: ChatConversation) => {
    await api.chatConversations.addHuddleCard(c.id, { ...offer, asOf: Date.now() })
    setDone(t('chuddle.added', { name: c.name }))
  })
  return (
    <details className="send-chat" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('chuddle.planWith')}<span className="visually-hidden"> {offer.title}</span></summary>
      <p role="status" className="visually-hidden">{done}</p>
      {done && <p className="muted">{done}</p>}
      {open && !rows && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
      {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('chuddle.noHuddle')} <Link to="/chat">{t('chuddle.goStart')}</Link></p>}
      {rows && rows.length > 0 && (
        <>
          <p className="muted">{t('chuddle.addBody')}</p>
          <ul className="chat-share__list">
            {rows.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <Button variant="secondary" disabled={add.busy} aria-label={t('chuddle.addTo', { title: offer.title, name: c.name })} onClick={() => void add.run(c).catch(() => undefined)}>{t('chuddle.addShort')}</Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {add.error && <p role="alert" className="field__error">{t('chuddle.addFailed')}</p>}
    </details>
  )
}
