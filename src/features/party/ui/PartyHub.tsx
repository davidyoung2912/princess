import { useState } from 'react'
import { Link } from 'react-router'
import { CONNECT_REF, inviteRef } from '../../../domain/shareCodes'
import { useMine } from '../../../shared/hooks/useMine'
import { api } from '../../../app/runtime'
import { t, th } from '../../../shared/i18n'
import { Card } from '../../../shared/ui/Card'
import { Load } from '../../account/ui/parts'
import { ShowCode } from '../../onboard/ui/ShowCode'

/**
 * The travel party in one place (research 2, A to E): the people you are connected with, your groups, one invitation sheet (QR, link, share, email) and plain words on
 * what connecting lets people do. It builds on chat's connections, groups and hand-over codes, so there is one list of people, not a second one for dining.
 */
export function PartyHub() {
  const people = useMine(() => api.chatConnections.list())
  const chats = useMine(() => api.chatConversations.list())
  const [aim, setAim] = useState<string>(CONNECT_REF)
  const groups = (chats.data ?? []).filter((c) => c.kind === 'group' && !c.closed)
  // A group that has since been left or deleted must not stay selected: fall back to connecting with the guest.
  const shareRef = aim !== CONNECT_REF && groups.some((g) => inviteRef(g.id) === aim) ? aim : CONNECT_REF
  const title = shareRef === CONNECT_REF ? t('party.hub.toParty') : groups.find((g) => inviteRef(g.id) === shareRef)?.name ?? t('party.hub.toParty')
  return (
    <>
      <p>{t('party.hub.intro')}</p>

      <Card labelledBy="hub-people-h">
        <h2 id="hub-people-h" className="card__title">{th('party.hub.people')}</h2>
        <Load state={people}>
          {(p) => p.connected.length === 0 ? <p className="muted">{t('party.hub.noPeople')}</p> : (
            <ul className="plain-list">
              {p.connected.map((c) => (
                <li key={c.id}>{c.name}{c.conversationId && <> · <Link to={`/chat/c/${encodeURIComponent(c.conversationId)}`}>{t('party.hub.open')}<span className="visually-hidden"> {c.name}</span></Link></>}</li>
              ))}
            </ul>
          )}
        </Load>
        <p><Link to="/chat/people">{t('party.hub.find')}</Link></p>
      </Card>

      <Card labelledBy="hub-groups-h">
        <h2 id="hub-groups-h" className="card__title">{th('party.hub.groups')}</h2>
        {groups.length === 0 ? <p className="muted">{t('party.hub.noGroups')}</p> : (
          <ul className="plain-list">
            {groups.map((g) => <li key={g.id}><Link to={`/chat/c/${encodeURIComponent(g.id)}`}>{g.name}</Link> <span className="muted">· {g.members.join(', ')}</span></li>)}
          </ul>
        )}
      </Card>

      <Card labelledBy="hub-invite-h">
        <h2 id="hub-invite-h" className="card__title">{th('party.hub.invite')}</h2>
        <p>{t('party.hub.inviteBody')}</p>
        {groups.length > 0 && (
          <div className="field">
            <label htmlFor="hub-aim">{t('party.hub.which')}</label>
            <select id="hub-aim" className="field__input" value={shareRef} onChange={(e) => setAim(e.target.value)}>
              <option value={CONNECT_REF}>{t('party.hub.toParty')}</option>
              {groups.map((g) => <option key={g.id} value={inviteRef(g.id)}>{t('party.hub.toGroup')}: {g.name}</option>)}
            </select>
          </div>
        )}
        {/* Keyed by what it is for, so changing the choice starts a fresh code instead of showing the old one. */}
        <ShowCode key={shareRef} shareRef={shareRef} title={title} />
      </Card>

      <Card info labelledBy="hub-perm-h">
        <h2 id="hub-perm-h" className="card__title">{th('party.hub.perm.title')}</h2>
        <ul className="plain-bullets">
          <li>{t('party.hub.perm.messages')}</li>
          <li>{t('party.hub.perm.plans')}</li>
          <li>{t('party.hub.perm.invite')}</li>
        </ul>
        <p>{t('party.hub.perm.manage')} <Link to="/chat/people">{t('party.hub.perm.go')}</Link></p>
      </Card>
    </>
  )
}
