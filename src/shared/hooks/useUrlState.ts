import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { sameParams, withParams, type ParamValues } from '../../app/routes/urlState'

/**
 * Mirrors a screen's filters into the address with `replace`, so they do not add history entries but Back, a reload and a shared link bring them
 * back. The screen still owns its state and reads its starting values from the address once (see `readUrlFilter`).
 */
export function useMirrorParams(values: ParamValues): void {
  const [params, setParams] = useSearchParams()
  const key = JSON.stringify(values)
  useEffect(() => {
    const next = withParams(params, JSON.parse(key) as ParamValues)
    if (!sameParams(params, next)) setParams(next, { replace: true })
    // `params` is read, not watched: writing our own values must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
