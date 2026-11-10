import { useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'

/** The signed-in account is a demo account (the server says so). */
export const useIsDemo = (): boolean => useSyncExternalStore(subscribeContext, getContext, getContext)?.isDemo === true
