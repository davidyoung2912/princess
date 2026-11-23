import { api } from '../runtime'
import type { ContactKind } from './ContactSteps'

/** The contact checks still to do, in the order they are asked (email, then phone): only what is on the account and not yet confirmed. */
export async function pendingChecks(): Promise<ContactKind[]> {
  const [email, phone] = await Promise.all([api.emailCheck.status(), api.phoneCheck.status()])
  return [...(email.hasEmail && !email.verified ? ['email' as const] : []), ...(phone.hasPhone && !phone.verified ? ['phone' as const] : [])]
}
