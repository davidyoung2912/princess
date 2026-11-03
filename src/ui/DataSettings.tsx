import { useState } from 'react'
import { t, th, type StringKey } from '../i18n'
import { resetDemoData, wipeAll } from '../runtime'
import { Banner } from './Banner'
import { Button } from './Button'
import { Card } from './Card'
import { Dialog } from './Dialog'

type Confirm = 'reset' | 'wipe' | null

/** Reset the demo, or wipe what this device keeps. Resetting and wiping ask first. */
export function DataSettings() {
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null)

  async function attempt(run: () => Promise<void>, done: StringKey | null) {
    try {
      await run()
      setMessage(done ? { kind: 'success', text: t(done) } : null)
    } catch {
      setMessage({ kind: 'danger', text: t('data.error.unavailable') })
    }
  }

  return (
    <Card labelledBy="data-h">
      <h2 id="data-h">{th('data.title')}</h2>
      <p>{t('data.intro')}</p>
      {message && <Banner kind={message.kind} title={message.text} />}
      <div className="stack">
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
