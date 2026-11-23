import { useState } from 'react'
import { t } from '../../../shared/i18n'
import { Dialog } from '../../../shared/ui/Dialog'
import { ScanQrCode } from '../../../shared/ui/icons'
import { ScannerPanel } from './ScannerPanel'

/** The scan icon in the top ribbon. It opens the scanner over the current page, so a guest never leaves what they were doing; focus returns here when it closes. */
export function ScanButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="testbar__at-link" data-tour="scan" aria-haspopup="dialog" aria-label={t('scan.open')} title={t('scan.open')} onClick={() => setOpen(true)}>
        <ScanQrCode aria-hidden="true" />
      </button>
      {open && (
        <Dialog title={t('scan.title')} onClose={() => setOpen(false)}>
          <div className="stack">
            <p>{t('scan.intro')}</p>
            <ScannerPanel autoStart onLeave={() => setOpen(false)} />
            <p className="muted">{t('qr.note')}</p>
          </div>
        </Dialog>
      )}
    </>
  )
}
