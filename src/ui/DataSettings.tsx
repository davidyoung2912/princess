import { useState } from 'react'
import { backupFileName, backupToText, createBackup } from '../data/backup'
import { mapStorageError } from '../data/errors'
import { t, type StringKey } from '../i18n'
import { getStore, resetDemoData, wipeAll } from '../runtime'
import { usePersona } from '../hooks/useDemo'
import { demoNow } from '../demo/store'
import { Banner } from './Banner'
import { Button } from './Button'
import { Card } from './Card'
import { Dialog } from './Dialog'

type Confirm = 'reset' | 'wipe' | null

/** Export a copy of the guest's data, reset the demo, or wipe the device. Resetting and wiping ask first. */
export function DataSettings() {
  const persona = usePersona()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null)

  async function attempt(run: () => Promise<void>, done: StringKey | null) {
    try {
      await run()
      setMessage(done ? { kind: 'success', text: t(done) } : null)
    } catch (e) {
      setMessage({ kind: 'danger', text: t(`data.error.${mapStorageError(e).code}` as StringKey) })
    }
  }

  const exportData = () => attempt(async () => {
    const now = new Date(demoNow())
    const backup = await createBackup(await getStore(), persona?.id ?? null, now)
    const url = URL.createObjectURL(new Blob([backupToText(backup)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(persona?.id ?? null, now)
    link.click()
    URL.revokeObjectURL(url)
  }, 'data.export.done')

  return (
    <Card labelledBy="data-h">
      <h2 id="data-h">{t('data.title')}</h2>
      <p>{t('data.intro')}</p>
      {message && <Banner kind={message.kind} title={message.text} />}
      <div className="stack">
        <Button variant="secondary" onClick={() => void exportData()}>{t('data.export')}</Button>
        <div>
          <Button variant="secondary" onClick={() => setConfirm('reset')}>{t('data.reset')}</Button>
          <p><small>{t('data.reset.hint')}</small></p>
        </div>
        <div>
          <Button variant="danger" onClick={() => setConfirm('wipe')}>{t('data.wipe')}</Button>
          <p><small>{t('data.wipe.hint')}</small></p>
        </div>
      </div>
      {confirm && (
        <Dialog title={t(confirm === 'reset' ? 'data.reset.confirm' : 'data.wipe.confirm')} onClose={() => setConfirm(null)}>
          <p>{t(confirm === 'reset' ? 'data.reset.hint' : 'data.wipe.body')}</p>
          <div className="button-row">
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t('data.cancel')}</Button>
            <Button
              variant={confirm === 'wipe' ? 'danger' : 'primary'}
              onClick={() => {
                const which = confirm
                setConfirm(null)
                void attempt(which === 'reset' ? resetDemoData : wipeAll, which === 'reset' ? 'data.reset.done' : null)
              }}
            >
              {t(confirm === 'reset' ? 'data.reset' : 'data.wipe')}
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}
