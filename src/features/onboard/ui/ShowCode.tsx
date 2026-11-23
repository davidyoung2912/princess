import { useId, useState } from 'react'
import { Copy } from 'lucide-react'
import { useAction } from '../../../shared/hooks/useAction'
import type { ShareCode } from '../../../shared/api/chatTypes'
import { CONNECT_REF, isIntroRef, directPath, handoffPath, LIFE_CHOICES, lifeWords, qrKindOf, shareUrl } from '../../../domain/shareCodes'
import { t } from '../../../shared/i18n'
import { api } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { QrCode } from '../../checkin/ui/QrCode'

/**
 * The code for one thing (docs/chat-bundles-plan.md, 5.6): a public item's code is drawn on the device at once and works with no signal; a personal item's code is made on the server, lasts 15 minutes, 1 hour or a day, and
 * can be stopped. Either way there is a text version of what the code holds and a Copy link button, so it can be handed over without a camera.
 */
export function ShowCode({ shareRef, title, onBack }: { shareRef: string; title: string; onBack?: () => void }) {
  const kind = qrKindOf(shareRef)
  const ids = useId()
  const [minutes, setMinutes] = useState(LIFE_CHOICES[0]!)
  const [code, setCode] = useState<ShareCode | null>(null)
  const [copied, setCopied] = useState<'yes' | 'no' | ''>('')
  const make = useAction(async () => setCode(await api.shares.create(shareRef, minutes)), { quiet: true })
  const stop = useAction(async () => { if (code) await api.shares.stop(code.id); setCode(null) }, { quiet: true })
  const refresh = useAction(async () => { const mine = await api.shares.mine(); const now = mine.find((c) => c.id === code?.id); setCode((c) => (c && now ? { ...c, scans: now.scans } : c)) }, { quiet: true })
  const path = kind === 'direct' ? directPath(shareRef) : code?.path ?? (code?.code ? handoffPath(code.code) : null)
  const url = path ? shareUrl(window.location.origin, path) : null
  const copy = async () => {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied('yes') } catch { setCopied('no') }
  }
  /** The phone's own share sheet (messages, mail, anything installed) where there is one; the guest picks who gets it. */
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const share = async () => {
    if (!url) return
    try { await navigator.share({ title, text: t('share.message', { title }), url }) } catch { /* the guest closed the sheet */ }
  }
  const mail = url ? `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${t('share.message', { title })}\n\n${url}`)}` : null
  return (
    <div className="show-code stack">
      <p className="chat-card__title">{title}</p>
      {kind === null && <p role="alert" className="field__error">{t('share.noCode')}</p>}
      {kind === 'handoff' && !code && (
        <>
          <div className="field">
            <label htmlFor={`${ids}-life`}>{t('share.life')}</label>
            <select id={`${ids}-life`} className="field__input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {LIFE_CHOICES.map((m) => <option key={m} value={m}>{t(lifeWords(m))}</option>)}
            </select>
          </div>
          <Button disabled={make.busy} onClick={() => void make.run()}>{t('share.make')}</Button>
          {make.error && <p role="alert" className="field__error">{t(make.error.code === 'conflict' ? 'share.tooMany' : 'share.makeFailed')}</p>}
        </>
      )}
      {url && (
        <>
          <QrCode text={url} label={t('share.qr.label', { title })} />
          <p className="muted">{t(kind === 'direct' ? 'share.what.direct' : shareRef === CONNECT_REF ? 'share.what.connect' : isIntroRef(shareRef) ? 'share.what.invite' : 'share.what.handoff', { title })}</p>
          <p className="muted share-code__url">{url}</p>
          <div className="button-row">
            <Button variant="secondary" icon={Copy} onClick={() => void copy()}>{t('share.copy')}</Button>
            {canShare && <Button variant="secondary" onClick={() => void share()}>{t('share.send')}</Button>}
            {mail && <a className="btn btn--secondary" href={mail}>{t('share.email')}</a>}
          </div>
          <p role="status" className={copied ? undefined : 'visually-hidden'}>{copied === 'yes' ? t('share.copied') : copied === 'no' ? t('share.copyFailed') : ''}</p>
          {kind === 'handoff' && code && (
            <>
              <p role="status">{t('share.scans', { count: code.scans })}</p>
              <Button variant="tertiary" disabled={refresh.busy} onClick={() => void refresh.run()}>{t('share.refresh')}</Button>
              <Button variant="danger" disabled={stop.busy} onClick={() => void stop.run()}>{t('share.stop')}</Button>
            </>
          )}
        </>
      )}
      {onBack && <Button variant="tertiary" onClick={onBack}>{t('share.back')}</Button>}
    </div>
  )
}
