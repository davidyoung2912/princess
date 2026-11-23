import { normalizeCatalogue, type StanleyCatalogue } from '../../features/stanley/logic/stanleyCapabilities'
import { fetchStanleyCapabilities } from '../../app/runtime'
import { useAsync } from './useAsync'

/** The server's catalogue of what Stanley can do. `catalogue` is null while loading or when the server's answer could not be read; screens then leave the examples out. */
export function useStanleyCapabilities(): { catalogue: StanleyCatalogue | null; status: 'loading' | 'ready' | 'error'; retry: () => void } {
  const r = useAsync(async () => normalizeCatalogue(await fetchStanleyCapabilities()), [])
  return { catalogue: r.data, status: r.status, retry: r.retry }
}
