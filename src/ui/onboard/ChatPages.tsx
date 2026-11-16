import { Link } from 'react-router'
import { useNavigate } from 'react-router'
import { canFindPeople, canUseGuestServices } from '../../domain/chatKeep'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Card } from '../Card'
import { People } from './ChatPeople'
import { Rooms } from './ChatRooms'
import { ChatSearch } from './ChatSearch'
import { Children } from './ChatGuardian'
import { Service } from './ChatScreen'

/** Before a booking is confirmed there is nobody on a sailing to chat with, so People, Rooms and Search say so and point back to Chat. */
function Gate({ need, children }: { need: 'people' | 'service'; children: React.ReactNode }) {
  const eligibility = useMine(() => api.chatConnections.eligibility())
  const ok = need === 'people' ? canFindPeople(eligibility.data) : canUseGuestServices(eligibility.data)
  if (ok) return <div className="page">{children}</div>
  return (
    <div className="page">
      <Card info><p>{t('chat.beforeBooking')}</p></Card>
      <p><Link to="/chat">{t('chat.backToChat')}</Link></p>
    </div>
  )
}

export const ChatPeopleScreen = () => <Gate need="people"><People /></Gate>

export function ChatRoomsScreen() {
  const nav = useNavigate()
  return <Gate need="people"><Rooms onOpen={(id) => { void nav(`/chat/c/${encodeURIComponent(id)}`) }} /></Gate>
}

export function ChatSearchScreen() {
  const nav = useNavigate()
  return <Gate need="people"><ChatSearch onPick={(h) => { void nav(`/chat/c/${encodeURIComponent(h.conversationId)}?m=${encodeURIComponent(h.messageId)}`) }} /></Gate>
}

export const ChatChildrenScreen = () => <div className="page"><Children /></div>

export const ChatServiceScreen = () => <Gate need="service"><Service /></Gate>
