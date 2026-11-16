import { Link } from 'react-router'
import type { ExplorerDay } from '../../api/explorerTypes'
import { formatTime } from '../../domain/cruise'
import { whatChanged, type ChangeLine } from '../../domain/explorer/whatChanged'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'

const TITLE: Partial<Record<ExplorerDay['explorer'], StringKey>> = { entertainment: 'exp.changed.title.entertainment', dining: 'exp.changed.title.dining' }

function text(c: ChangeLine): string {
  const base = { title: c.title, venue: c.venueTitle }
  if (c.status === 'cancelled') return c.reason ? t('exp.changed.cancelledWhy', { ...base, reason: c.reason }) : t('exp.changed.cancelled', base)
  const moved = { ...base, was: formatTime(c.was ?? c.start), time: formatTime(c.start) }
  return c.reason ? t('exp.changed.movedWhy', { ...moved, reason: c.reason }) : t('exp.changed.moved', moved)
}

/** Everything the ship has moved or cancelled on this Explorer for the chosen day, in one place, so the guest need not open every venue. Hidden when nothing has changed. */
export function WhatChanged({ data, now, basePath }: { data: ExplorerDay; now: number; basePath: string }) {
  const changes = whatChanged(data, now)
  if (changes.length === 0) return null
  return (
    <Card labelledBy="exp-changed-h">
      <h2 id="exp-changed-h" className="card__title">{t(TITLE[data.explorer] ?? 'exp.changed.title.other')}</h2>
      <ul className="plain-bullets">
        {changes.map((c) => (
          <li key={c.id}>
            <Link to={`${basePath}/${c.venueId}?day=${data.day}`}>{text(c)}</Link>{' '}
            {c.mine && <StatusBadge kind={c.status === 'cancelled' ? 'cancelled' : 'changed'} label={t('exp.changed.mine')} />}
          </li>
        ))}
      </ul>
    </Card>
  )
}
