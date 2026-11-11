/** Stanley's help with writing (docs/chat-stanley-plan.md, phases 1 and 2). Framework-free; mirrors the limits of `ChatRewordRules` on the server, which decides everything else. */
import type { ChatReword, ChatRewordMode, ChatStanleyStatus } from '../api/chatTypes'

/** The longest draft Stanley is sent (the server's `MaxDraft`). */
export const REWORD_MAX = 500

/** Whether a draft can be sent to Stanley for help: something is written and it is not too long. */
export const canAskReword = (text: string): boolean => text.trim().length > 0 && text.length <= REWORD_MAX

/** "Help me reword" appears under the note for a message the word filter refused, and only where Stanley's chat help is on. */
export const showRewordHelp = (problem: string | null | undefined, on: boolean, text: string): boolean => on && problem === 'blocked' && canAskReword(text)

export type RewordProblem = 'offline' | 'supervised' | 'empty' | 'other'

/** The kind of failure from an API error (not a "no suggestion" answer, which is a normal reply). */
export function rewordProblem(code: string, message: string | undefined): RewordProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  if (message === 'supervised') return 'supervised'
  if (message === 'empty' || message === 'mode') return 'empty'
  return 'other'
}

/** Whether a reply holds a suggestion the guest can use. */
export const hasSuggestion = (r: Pick<ChatReword, 'suggestion'>): r is { suggestion: string } => typeof r.suggestion === 'string' && r.suggestion.trim().length > 0

/** Whether Stanley's friendly chat help is on (the server says so; a missing status means off). */
export const helpIsOn = (status: Pick<ChatStanleyStatus, 'on'> | undefined): boolean => status?.on === true

/** The line for a request problem (the server's `cooldown`, `tooManyOpen`, `tooMany`, `alreadyAsked`), or undefined to keep the app's own wording. */
export const problemLine = (status: Pick<ChatStanleyStatus, 'on' | 'lines'> | undefined, problem: string): string | undefined => (helpIsOn(status) ? status!.lines[problem] : undefined)

export const MODE_LABEL: Record<ChatRewordMode, 'cw.friendlier' | 'cw.shorter' | 'cw.reword'> = { friendlier: 'cw.friendlier', shorter: 'cw.shorter', reword: 'cw.reword' }

/** The message box after "Use this": the suggestion, cut to the box's length. The guest still presses Send. */
export const useSuggestion = (suggestion: string, max: number): string => suggestion.slice(0, max)

/** Whether an opener may be put in an empty conversation's message box: only in an accepted chat with nothing said yet. */
export const offerOpeners = (on: boolean, messageCount: number, bubbleCount: number): boolean => on && messageCount === 0 && bubbleCount === 0
