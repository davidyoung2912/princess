import { Component, type ReactNode } from 'react'
import { t } from './i18n'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** The key under which the time of the last automatic reload is kept, so a page that still fails does not reload forever. */
const RELOADED = 'princess:reloaded'
const RELOAD_GAP_MS = 60_000

/** True for the failure of a lazily loaded file, which happens when an installed copy points at files a newer version replaced. */
const staleFiles = (e: Error) => /dynamically imported module|importing a module script|failed to fetch|loading chunk|loading css chunk/i.test(`${e.name} ${e.message}`)

function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
    if (Date.now() - last < RELOAD_GAP_MS) return false
    sessionStorage.setItem(RELOADED, String(Date.now()))
  } catch {
    return false
  }
  location.reload()
  return true
}

/** Keeps a failure in one screen from blanking the whole app: a stale copy reloads itself once, anything else says what to do. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (staleFiles(error)) reloadOnce()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="page" role="alert">
        <h1>{t('error.title')}</h1>
        <p>{staleFiles(error) ? t('error.stale') : t('error.body')}</p>
        <p>{t('error.help')}</p>
        <p>
          <button type="button" onClick={() => location.reload()}>{t('error.reload')}</button>{' '}
          <button type="button" onClick={() => this.setState({ error: null })}>{t('error.tryAgain')}</button>
        </p>
      </main>
    )
  }
}
