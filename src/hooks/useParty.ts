import { useCallback, useSyncExternalStore } from 'react'
import { addInvite, addNote, removeInvite, removeNote, type InviteProblem, type NoteProblem } from '../domain/party'
import { getParty, subscribeParty, updateParty } from '../party/store'
import { useOwnerId, usePersona } from './useDemo'

const newId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** The signed-in person's travel party: the shared invitations and notes for their booking, and functions to change them. */
export function useParty() {
  const me = usePersona()
  const owner = useOwnerId()
  const booker = me?.booker ?? owner
  const state = useSyncExternalStore(subscribeParty, () => getParty(booker), () => getParty(booker))
  const invite = useCallback((email: string): InviteProblem | null => {
    const result = addInvite(getParty(booker), email, Date.now(), newId())
    if (!result.problem) updateParty(booker, () => result.state)
    return result.problem
  }, [booker])
  const uninvite = useCallback((id: string) => updateParty(booker, (s) => removeInvite(s, id)), [booker])
  const note = useCallback((text: string): NoteProblem | null => {
    const result = addNote(getParty(booker), me?.id ?? '', text, Date.now(), newId())
    if (!result.problem) updateParty(booker, () => result.state)
    return result.problem
  }, [booker, me?.id])
  const unnote = useCallback((id: string) => updateParty(booker, (s) => removeNote(s, id, me?.id ?? '')), [booker, me?.id])
  return { state, me, invite, uninvite, note, unnote }
}
