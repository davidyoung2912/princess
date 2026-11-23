import { useId } from 'react'
import { Pin } from 'lucide-react'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { parseSharePath, receiveProblem } from '../../domain/shareCodes'
import { parseBundle } from '../../domain/chatBundles'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { BundleCard } from '../onboard/BundleCard'

/**
 * What a scanned hand-over code offers (docs/chat-bundles-plan.md, 5.6): the same card as in chat, who it is from, and what can be done with it: Open, Save, Dismiss. Finding it never acts by itself and puts nothing in
 * anyone's plan or chats. A wrong, stopped or expired code says one thing and never whether it ever existed; an item this sailing does not have says so.
 */
export function ReceiveSheet({ path, onDone }: { path: string; onDone: () => void }) {
  const target = parseSharePath(path, window.location.origin)
  const headingId = useId()
  const preview = useAsync(async () => {
    if (!target) throw Object.assign(new Error('invalid'), { code: 'notFound' })
    return target.kind === 'code' ? api.shares.open(target.code) : api.shares.direct(target.type, target.ref)
  }, [path])
  const saved = useAsync(() => api.ahead.saved.list(), [path])
  const toggle = useAction((key: string) => api.ahead.saved.toggle(key), { quiet: true })
  const bundle = preview.data ? parseBundle(preview.data.bundle) : null
  const key = preview.data?.saveKey
  const isSaved = key !== undefined && (saved.data ?? []).includes(key)
  const problem = preview.status === 'error' ? receiveProblem(preview.error) : null
  return (
    <section className="receive" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('receive.title')}</h3>
      {preview.status === 'loading' && !bundle && <p role="status" className="muted">{t('receive.loading')}</p>}
      {problem && (
        <div role="alert">
          <p>{t(problem === 'stopped' ? 'receive.stopped' : problem === 'notOnSailing' ? 'receive.notOnSailing' : 'receive.failed')}</p>
          {problem === 'failed' && <Button variant="secondary" onClick={preview.retry}>{t('scan.retry')}</Button>}
        </div>
      )}
      {bundle && (
        <>
          <p className="muted">{preview.data?.from ? t('receive.from', { name: preview.data.from }) : t('receive.fromGuest')}</p>
          <BundleCard bundle={bundle} onOpen={onDone} />
          <div className="receive__actions">
            {key && (
              <Button variant="secondary" icon={Pin} aria-pressed={isSaved} disabled={toggle.busy || saved.status === 'loading'} onClick={() => void toggle.run(key).then((list) => { if (list) saved.retry() })}>
                {isSaved ? t('receive.saved') : t('receive.save')}
              </Button>
            )}
            <Button variant="tertiary" onClick={onDone}>{t('receive.dismiss')}</Button>
          </div>
          <p role="status" className="visually-hidden">{toggle.error ? t('receive.saveFailed') : ''}</p>
        </>
      )}
    </section>
  )
}
