import { createChannel, type Channel } from '../data/sync'

let real: Channel | null = null
const ensure = (): Channel => (real ??= createChannel())

/** The one cross-tab channel for the app. It opens on first use, so server-rendered tests never open one. */
export const channel: Channel = {
  post: (m) => ensure().post(m),
  subscribe: (l) => ensure().subscribe(l),
  close: () => { real?.close(); real = null },
}
