import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { t } from '../../../shared/i18n'
import { SendDialog, type SendItem } from './SendDialog'

/** The chat icon on a shareable thing: opens the send dialog. Its name says what it sends ("Send Crown Grill to chat"). */
export function ShareButton({ item }: { item: SendItem }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-btn share-btn" aria-label={t('sendchat.label', { title: item.title })} title={t('sendchat.title')} onClick={() => setOpen(true)}>
        <MessageSquarePlus aria-hidden="true" />
      </button>
      {open && <SendDialog item={item} onClose={() => setOpen(false)} />}
    </>
  )
}
