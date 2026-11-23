import type { ApiError } from '../../../shared/api/errors'
import { api } from '../../../app/runtime'
import { useAction } from '../../../shared/hooks/useAction'
import { useMine } from '../../../shared/hooks/useMine'
import { t, type StringKey } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { ActionError } from '../../account/ui/parts'

/** Why a before-the-cruise change was refused, in words that say what to do next. Falls back to the general wording. */
export function AheadError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'conflict' || error.code === 'invalid' || error.code === 'forbidden') {
    const text = t(`ah.err.${error.message}` as StringKey)
    if (!text.startsWith('ah.err.')) return <p role="alert" className="field__error">{text}</p>
  }
  return <ActionError error={error} />
}

export { Back, ChildNote } from '../../aboard/ui/common'

/** Keeps an item for later in the shared cart (PRE-11). The key is `item:<id>`, `excursion:<id>`, `venue:<id>` or `addon:<id>`. */
export function SaveButton({ saveKey, name }: { saveKey: string; name: string }) {
  const saved = useMine(() => api.ahead.saved.list())
  const toggle = useAction(async () => { await api.ahead.saved.toggle(saveKey); saved.retry() })
  const on = saved.data?.includes(saveKey) ?? false
  return (
    <Button variant="tertiary" aria-pressed={on} disabled={toggle.busy || saved.status !== 'ready'} onClick={() => void toggle.run()}>
      {on ? t('cart.saved') : t('cart.save')}<span className="visually-hidden"> {name}</span>
    </Button>
  )
}
