/** Shared shapes for the concierge (DIS-09, SUP-03). Framework-free, so it is tested in node. */
export interface Citation {
  label: string
  /** An address inside the app. */
  path: string
}

export type Source = 'claude' | 'scripted' | 'handoff'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /** Where an answer came from; a guest's own message has none. Every assistant message is labelled with it. */
  source?: Source
  /** The screens an answer was grounded on, shown as links under it. */
  citations?: Citation[]
}

/** Who is asking, and when, so answers are about their cruise and the demo clock. */
export interface Context {
  sailingId: string
  personaId: string
  /** The demo clock's now. */
  now: number
}

export interface ToolResult {
  /** JSON text handed back to the model. */
  content: string
  citations: Citation[]
  isError?: boolean
}

export interface Reply {
  text: string
  citations: Citation[]
  source: Source
}
