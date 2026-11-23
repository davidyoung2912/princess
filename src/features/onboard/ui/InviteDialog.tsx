import { useEffect, useState } from 'react'
import type { ChatConversation } from '../../../shared/api/chatTypes'
import { MAX_MESSAGE } from '../../chat/domain/chat'
import { newClientId } from '../../chat/domain/chatThread'
import { useAction } from '../../../shared/hooks/useAction'
import { api } from '../../../app/runtime'
import { t } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { DialogHeader } from '../../../shared/ui/DialogHeader'
import { TextArea } from '../../../shared/ui/Field'
import { Users } from '../../../shared/ui/icons'
import { shareError } from '../../chat/ui/chatShareError'

/** The conversations an invitation can go to: the travel party, a person, or a group. Stanley, channels and rooms are not for inviting. */
const canInvite = (c: ChatConversation): boolean => (c.kind === 'party' || c.kind === 'direct' || c.kind === 'group') && !c.closed

/**
 * "Invite" on a planned event: who to invite (the guest's own chats), and a ready-made message about the event that can be changed before it is sent. The message goes to each chosen
 * chat as an ordinary message, so the people in it can answer there.
 */
export function InviteDialog({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const [rows, setRows] = useState<ChatConversation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState(message)
  const [sent, setSent] = useState('')
  useEffect(() => {
    api.chatConversations.list().then((l) => setRows(l.filter(canInvite)), () => setFailed(true))
  }, [])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const send = useAction(async () => {
    const body = text.trim()
    for (const id of picked) await api.chatConversations.send(id, body, newClientId())
    setSent(t('invite.sent'))
    setPicked([])
  })
  return (
    <Dialog title={t('invite.title')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={t('invite.title')} subtext={t('invite.sub', { title })} icon={Users} onClose={onClose} />}>
      <div className="stack">
        {rows === null && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
        {rows && rows.length === 0 && <p className="muted">{t('invite.none')}</p>}
        {rows && rows.length > 0 && (
          <fieldset className="plain-fieldset">
            <legend>{t('invite.who')}</legend>
            {rows.map((c) => (
              <label key={c.id} className="choice choice--top">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.name}{c.members.length > 1 && <small>{c.members.join(', ')}</small>}</span>
              </label>
            ))}
          </fieldset>
        )}
        <TextArea label={t('invite.message')} value={text} maxLength={MAX_MESSAGE} onChange={(e) => setText(e.target.value)} />
        {send.error && <p role="alert" className="field__error">{t(shareError(send.error))}</p>}
        {sent && <p role="status" className="muted">{sent}</p>}
        <div className="button-row">
          <Button disabled={send.busy || picked.length === 0 || !text.trim()} onClick={() => void send.run()}>{t('invite.send')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
