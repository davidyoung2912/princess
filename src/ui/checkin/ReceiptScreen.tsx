import { Link } from 'react-router'
import type { ReceiptItem } from '../../api/types'
import { asReceiptView } from '../../api/guards'
import { api } from '../../runtime'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { SyncChip } from '../SyncChip'
import { LoadError } from '../discover/parts'
import { formatDateTime } from '../account/format'
import type { StepId } from '../../domain/checkin'

const FIX: Record<StepId, string> = {
  confirm: '/me/profile', document: '/home/check-in/document', photo: '/home/check-in/photo', emergency: '/home/check-in/emergency',
  payment: '/home/check-in/payment', contract: '/home/check-in/contract', health: '/home/check-in/health', arrival: '/home/check-in/arrival',
}

/** "What we have on file" (CHK-13): each item saved for each guest, when, and how to correct it. A copy is kept on the phone, so it opens offline. */
export function ReceiptScreen() {
  const me = usePersona()
  const receipt = useSavedCopy('receipt', me?.booker ?? 'none', () => api.checkin.receipt(), asReceiptView, [me?.id])
  const now = useNow()
  return (
    <div className="page">
      <h1>{t('route.receipt')}</h1>
      <p>{t('receipt.intro')}</p>
      {receipt.data ? (
        <>
          {receipt.at !== null && <SyncChip updated={new Date(receipt.at)} now={new Date(now)} state={receipt.fromCopy ? 'offline' : 'live'} timeZone="America/New_York" />}
          {receipt.fromCopy && <Banner kind="offline" title={t('receipt.offline')}><p>{t('receipt.offlineBody')}</p></Banner>}
          {!receipt.data.complete && <Banner kind="warning" title={t('receipt.notComplete')} action={<LinkButton to="/home/check-in" variant="secondary">{t('route.checkin')}</LinkButton>} />}
          <p className="muted">{t('trip.booking', { number: receipt.data.number })}{receipt.data.finishedAt ? ` · ${t('checkin.finishedAt', { when: formatDateTime(receipt.data.finishedAt) })}` : ''}</p>
          {receipt.data.guests.map((g) => (
            <Card key={g.id}>
              <h2 className="card__title">{g.name}</h2>
              <Items items={g.items} guest={g.id} />
            </Card>
          ))}
          <Card>
            <h2 className="card__title">{t('receipt.booking')}</h2>
            <Items items={receipt.data.booking} />
          </Card>
          <p className="muted">{t('receipt.safe')}</p>
        </>
      ) : receipt.status === 'error' ? <LoadError retry={receipt.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>}
      <p className="book-nav"><Link to="/home/check-in">{t('route.checkin')}</Link></p>
    </div>
  )
}

function Items({ items, guest }: { items: ReceiptItem[]; guest?: string }) {
  return (
    <ul className="plain-list">
      {items.map((i) => (
        <li key={i.step}>
          <span>
            <strong>{t(`checkin.step.${i.step}` as StringKey)}</strong>
            <br /><span className="muted">{i.savedAt === null ? t('receipt.notSaved') : `${i.detail ? `${i.detail} · ` : ''}${t('receipt.savedAt', { when: formatDateTime(i.savedAt) })}`}</span>
          </span>
          <span>
            {i.savedAt === null ? <StatusBadge kind="changed" label={t('receipt.notSavedBadge')} /> : <StatusBadge kind="booked" label={t('receipt.savedBadge')} />}{' '}
            <Link to={`${FIX[i.step]}${guest && i.step !== 'confirm' ? `?guest=${guest}` : ''}`}>{i.savedAt === null ? t('receipt.add') : t('receipt.correct')}<span className="visually-hidden"> {t(`checkin.step.${i.step}` as StringKey)}</span></Link>
          </span>
        </li>
      ))}
    </ul>
  )
}
