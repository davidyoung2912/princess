import { minutesOf, type PlanRow } from './planChange'

/**
 * "Ask your cruise" (XA-01): answers from the guest's own plan, to-do list and bill, with the screen each answer came from.
 * When the data does not say, it says so and does not guess. The same facts a screen already shows; nothing is invented.
 * Changes the assistant proposes (XA-02) are in `planChange.ts`: propose, confirm, do, undo.
 */
export interface Source { label: string; path: string }
export interface Facts {
  /** Ship time now, "HH:MM". */
  nowHhmm: string
  plan: readonly PlanRow[]
  /** Null when the list has not loaded (offline or still loading): the assistant says it cannot see it rather than saying there is nothing. */
  todo: readonly { label: string; path: string }[] | null
  charges: readonly { label: string; cents: number; reason: string }[] | null
  /** "HH:MM" local time on a port day, when there is one. */
  allAboard: string | null
}

export interface Answer { text: string; sources: Source[]; known: boolean }

const usd = (cents: number): string => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
const UNKNOWN: Answer = { text: 'I do not know that from your trip. I can answer about your plan for today, what is left to do, your charges and when to be back aboard. For anything else, Guest Services can help.', sources: [], known: false }

const CANNOT_SEE = (what: string): string => `I cannot see ${what} right now. It may still be loading, or you may be offline. Try again in a moment.`

const live = (f: Facts) => f.plan.filter((r) => r.state !== 'dropped')

export function ask(question: string, f: Facts): Answer {
  const q = question.toLowerCase()

  if (/\bdinner\b/.test(q)) {
    const d = live(f).find((r) => r.entry.kind === 'dinner')
    return d
      ? { text: `Your dinner is at ${d.entry.start}: ${d.entry.title}.`, sources: [{ label: 'Your day', path: '/plan/day' }, { label: 'Dining', path: '/plan/dining' }], known: true }
      : { text: 'There is no dinner in your plan for today.', sources: [{ label: 'Dining', path: '/plan/dining' }], known: true }
  }

  if (/all.?aboard|back (on|at|to) the ship|be back|last tender/.test(q)) {
    return f.allAboard
      ? { text: `All aboard is ${f.allAboard}, in the port’s time. The ship leaves without latecomers, so aim to be back well before.`, sources: [{ label: 'Port day', path: '/ship/port' }], known: true }
      : { text: 'The ship is not in a port today, so there is no all-aboard time.', sources: [{ label: 'Port day', path: '/ship/port' }], known: true }
  }

  if (/what('?s| is) next|next up|coming up|what now/.test(q)) {
    const next = live(f).find((r) => minutesOf(r.entry.start) >= minutesOf(f.nowHhmm))
    return next
      ? { text: `Next is ${next.entry.title} at ${next.entry.start}.`, sources: [{ label: 'Your day', path: '/plan/day' }], known: true }
      : { text: 'Nothing else is left in your plan for today.', sources: [{ label: 'Your day', path: '/plan/day' }], known: true }
  }

  if (/still (need|have)|to.?do|left to do|outstanding|what do i need/.test(q)) {
    if (f.todo === null) return { text: CANNOT_SEE('your checklist'), sources: [{ label: 'Checklist', path: '/plan/checklist' }], known: false }
    return f.todo.length === 0
      ? { text: 'Nothing is waiting for you.', sources: [{ label: 'Checklist', path: '/plan/checklist' }], known: true }
      : { text: `Still to do:\n${f.todo.map((t) => `• ${t.label}`).join('\n')}`, sources: [{ label: 'Checklist', path: '/plan/checklist' }, ...f.todo.slice(0, 2).map((t) => ({ label: t.label, path: t.path }))], known: true }
  }

  if (/\b(charge|charged|bill|cost|paid|why)\b/.test(q) && /\$?\d/.test(q)) {
    if (f.charges === null) return { text: CANNOT_SEE('your bill'), sources: [{ label: 'Your bill', path: '/me/bill' }], known: false }
    const m = /\$?(\d+(?:\.\d{1,2})?)/.exec(q)
    const cents = m ? Math.round(Number(m[1]) * 100) : null
    const found = cents === null ? [] : f.charges.filter((c) => c.cents === cents)
    const src = [{ label: 'Your bill', path: '/me/bill' }]
    return found.length > 0
      ? { text: found.map((c) => `${usd(c.cents)} is ${c.label}. ${c.reason}`).join('\n'), sources: src, known: true }
      : { text: `I cannot find a charge of ${cents === null ? 'that amount' : usd(cents)} on your bill. Check the bill, or ask Guest Services to look.`, sources: src, known: false }
  }

  return UNKNOWN
}

/** Suggested questions the assistant can always answer. */
export const EXAMPLES: readonly string[] = ['What time is dinner?', 'What is next?', 'What do I still need to do?', 'When must I be back on the ship?']
