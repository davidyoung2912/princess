import { permissionWorks, type Helper, type PermissionId } from './account'
import type { HomeState } from './homeLink'
import { isLive } from './homeLink'
import type { PartyState } from './party'
import type { Sharing, SharingFacet } from './partyShare'
import { SHARING_FACETS } from './partyShare'

/**
 * "Who can see what" (IDN-07): one list over the three separate ways a guest lets someone in: a family helper (account.ts), a
 * family-at-home link (homeLink.ts) and the travel party (party.ts, partyShare.ts). Read-only: each row is changed on its own
 * screen. Framework-free. The location of the guest is never an item here, because nothing in the app shares it.
 */
export type AccessKind = 'helper' | 'home' | 'invite' | 'party'
export type AccessStatus = 'active' | 'waiting' | 'ended'
export type AccessItem = PermissionId | 'shipFacts' | `share.${SharingFacet}`

export interface AccessRow {
  id: string
  kind: AccessKind
  /** A name, an email address, or null for the party as a whole. */
  who: string | null
  status: AccessStatus
  /** What they can see or do, in a fixed order. Empty when the row has ended or is waiting. */
  items: AccessItem[]
  /** When it stops by itself, or null. */
  until: number | null
  /** The screen where it is changed. */
  path: string
}

export interface AccessInput { helper: Helper | null; home: HomeState; party: PartyState; sharing: Sharing; now: number }

/** Every row the guest has set up, active ones first. Ended helper and expired links are kept so the guest can see they are off. */
export function accessRows({ helper, home, party, sharing, now }: AccessInput): AccessRow[] {
  const rows: AccessRow[] = []
  if (helper) {
    const status: AccessStatus = helper.status === 'active' ? 'active' : helper.status === 'requested' ? 'waiting' : 'ended'
    rows.push({ id: 'helper', kind: 'helper', who: helper.name, status, items: status === 'active' ? helper.permissions.filter(permissionWorks) : [], until: null, path: '/me/helper' })
  }
  for (const c of home.contacts) {
    const live = home.links.filter((l) => l.contactId === c.id && isLive(l, now))
    const until = live.length ? Math.max(...live.map((l) => l.expiresAt)) : null
    rows.push({ id: `home:${c.id}`, kind: 'home', who: c.name, status: live.length ? 'active' : 'ended', items: live.length ? ['shipFacts'] : [], until, path: '/plan/family-link' })
  }
  for (const i of party.invites) rows.push({ id: `invite:${i.id}`, kind: 'invite', who: i.email, status: 'waiting', items: [], until: null, path: '/plan/party' })
  const shared = SHARING_FACETS.filter((f) => sharing[f]).map((f): AccessItem => `share.${f}`)
  rows.push({ id: 'party', kind: 'party', who: null, status: shared.length ? 'active' : 'ended', items: shared, until: null, path: '/plan/party' })
  const rank = { active: 0, waiting: 1, ended: 2 } as const
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.status] - rank[b.r.status] || a.i - b.i).map((x) => x.r)
}

/** How many people or groups can see something right now. */
export const activeCount = (rows: readonly AccessRow[]): number => rows.filter((r) => r.status === 'active').length
