import { useLocation } from 'react-router'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { AvatarPicker } from '../AvatarPicker'
import { DisplaySettings } from '../DisplaySettings'
import { Chip } from '../Chip'
import { useState } from 'react'
import type { ChatSettings } from '../../api/chatTypes'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { ActionError } from '../account/parts'

/** The choice to be found by other guests. On unless the guest turns it off, here or later in Chat settings. */
function Discoverable() {
  const stored = useMine(() => api.chatConnections.settings())
  const [shown, setShown] = useState<ChatSettings | null>(null)
  const current = shown ?? stored.data
  const save = useAction(async (next: ChatSettings) => {
    setShown(next)
    try { setShown(await api.chatConnections.saveSettings(next)) } catch (e) { setShown(null); throw e }
  })
  return (
    <Card labelledBy="app-welcome-find-h">
      <h2 id="app-welcome-find-h">{th('appWelcome.find.title')}</h2>
      <p>{t('appWelcome.find.body')}</p>
      {current && <div className="chip-row"><Chip pressed={current.findable} onToggle={() => void save.run({ ...current, findable: !current.findable })}>{t('appWelcome.find.chip')}</Chip></div>}
      <ActionError error={save.error} />
      <p className="app-welcome__hint">{t('appWelcome.find.hint')}</p>
    </Card>
  )
}

/** Where "Continue" goes: the screen the guest was opening (Stanley's introduction, then the stage welcome, take over from there), otherwise Home. */
const back = (from: unknown): string => (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/welcome') ? from : '/')

/**
 * The first thing a new guest sees: a warm welcome to the app, the basic display settings and the choice of avatar. Stanley's introduction follows it.
 * Every choice is saved as it is made, so leaving the page any way at all keeps them.
 */
export function AppWelcome() {
  const { state } = useLocation()
  const to = back((state as { from?: unknown } | null)?.from)
  return (
    <div className="page welcome app-welcome">
      <Card hero labelledBy="app-welcome-hello-h">
        <h2 id="app-welcome-hello-h">{t('appWelcome.h.hello')}</h2>
        <p>{t('appWelcome.hello')}</p>
      </Card>
      <Card labelledBy="app-welcome-avatar-h">
        <h2 id="app-welcome-avatar-h">{th('avatar.title')}</h2>
        <p>{t('avatar.intro')}</p>
        <AvatarPicker />
        <p className="app-welcome__hint">{t('appWelcome.avatar.hint')}</p>
      </Card>
      <Discoverable />
      <div className="button-row"><LinkButton to={to} replace>{t('appWelcome.go')}</LinkButton></div>
      <section aria-labelledby="app-welcome-settings-h">
        <h2 id="app-welcome-settings-h">{th('appWelcome.h.settings')}</h2>
        <p>{t('appWelcome.settings.intro')}</p>
        <DisplaySettings />
      </section>
      <div className="button-row"><LinkButton to={to} replace>{t('appWelcome.go')}</LinkButton></div>
    </div>
  )
}
