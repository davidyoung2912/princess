import { useEffect, useState } from 'react'
import type { ChatStanleyStatus } from '../api/chatTypes'
import { api } from '../runtime'

/** One shared answer for a minute, so a list of request cards asks the server once, not once per card. */
let shared: { at: number; promise: Promise<ChatStanleyStatus> } | null = null
const FRESH_MS = 60_000

function load(): Promise<ChatStanleyStatus> {
  if (!shared || Date.now() - shared.at > FRESH_MS) {
    const promise = api.chatConversations.stanleyStatus()
    shared = { at: Date.now(), promise }
    promise.catch(() => { if (shared?.promise === promise) shared = null })
  }
  return shared.promise
}

/** Stanley's friendly chat help: whether it is on for this guest, and his lines. Undefined until it loads, and if it cannot be reached (his buttons then stay hidden and chat works as before). */
export function useStanleyStatus(): ChatStanleyStatus | undefined {
  const [status, setStatus] = useState<ChatStanleyStatus | undefined>(undefined)
  useEffect(() => {
    let live = true
    load().then((x) => { if (live) setStatus(x) }, () => undefined)
    return () => { live = false }
  }, [])
  return status
}
