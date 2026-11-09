import { useState } from 'react'
import { groupRequest, normalizeGroupStatus, type GroupStatus } from '../../ai/stanleyPlanner'
import type { Poll } from '../../domain/board'
import { t, type StringKey } from '../../i18n'
import { stanleyPlanner } from '../../runtime'
import { Button } from '../Button'

/**
 * Stanley's read of one poll (phase 9): who has answered, what leads, a compromise when every choice has an objection, and a reminder to copy for those who have not answered. Silence is never counted as
 * a yes, no reasons are sent, and Stanley sends nothing: the guest copies the reminder and sends it.
 */
export function StanleyGroupCard({ poll, members, organiser }: { poll: Poll; members: readonly { id: string; name: string }[]; organiser: boolean }) {
  const [status, setStatus] = useState<GroupStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const ask = async () => {
    setFailed(false); setCopied(false)
    try { setStatus(normalizeGroupStatus(await stanleyPlanner.groupStatus(groupRequest(poll, members, organiser)))) } catch { setFailed(true) }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(status?.reminderText ?? ''); setCopied(true) } catch { setCopied(false) } }
  return (
    <div>
      <Button variant="tertiary" onClick={() => void ask()}>{t('group9.go')}<span className="visually-hidden"> {poll.question}</span></Button>
      <div role="status">
        {failed && <p>{t('group9.failed')}</p>}
        {status && (
          <>
            <p>{t(`group9.state.${status.state}` as StringKey)} · {t('group9.counts', { answered: status.answered, silent: status.silent })}</p>
            <p>{status.suggestion.text}</p>
            {status.remains.length > 0 && <ul>{status.remains.map((r) => <li key={r}>{r}</li>)}</ul>}
            {status.reminderDue && status.reminderText && (
              <>
                <p>{t('group9.reminderDue')}</p>
                <Button variant="secondary" onClick={() => void copy()}>{t('group9.remind')}</Button>
                {copied && <span> {t('group9.copied')}</span>}
              </>
            )}
            <p className="muted">{status.note}</p>
          </>
        )}
      </div>
    </div>
  )
}
