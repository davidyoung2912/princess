import { t, type StringKey } from '../i18n'
import { SCREEN_BY_ID } from '../routes/screens'
import type { Citation } from './types'

/** The labels a card may carry (docs/stanley-gap-analysis-and-plan.md, phase 3). Anything else the server sends is dropped, so a card never shows a label the guest cannot read about. */
export const CHIPS = ['Your booking', 'Ship schedule', 'Princess policy', 'Estimated', 'Cached'] as const
export type CardChip = (typeof CHIPS)[number]
/** How current the data is: read just now (`live`), read earlier (`cached`), a forecast (`estimated`), or published text that can change (`provisional`). */
export const FRESHNESS = ['live', 'cached', 'estimated', 'provisional'] as const
export type Freshness = (typeof FRESHNESS)[number]

/** Where an answer came from. `dataTime` is when the data was read or published (epoch ms, from the data, never the time of the reply), or null when there is no data. */
export interface CardProvenance {
  chips: CardChip[]
  owner: string
  dataTime: number | null
  freshness: Freshness
  checkWithPerson: boolean
  note: string
}

/** A structured answer: a title, plain lines, where it came from, and the screens to open. `abstained` is true when it says "I cannot confirm". */
export interface StanleyCard {
  id: string
  title: string
  lines: string[]
  abstained: boolean
  links: Citation[]
  provenance: CardProvenance
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** Reads a card from the server's reply; anything that is not the agreed shape gives null, so the plain text is shown instead. */
export function normalizeCard(raw: unknown): StanleyCard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const p = o.provenance && typeof o.provenance === 'object' ? (o.provenance as Record<string, unknown>) : null
  const title = text(o.title, 120)
  if (!p || !title || !Array.isArray(o.lines)) return null
  const lines = o.lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0).map((l) => l.slice(0, 600)).slice(0, 12)
  if (lines.length === 0) return null
  const freshness = FRESHNESS.find((f) => f === p.freshness)
  if (!freshness) return null
  const at = typeof p.dataTime === 'string' ? Date.parse(p.dataTime) : NaN
  const links: Citation[] = Array.isArray(o.links)
    ? o.links.flatMap((c): Citation[] => {
        const x = c as Partial<Citation> | null
        return x && typeof x.label === 'string' && typeof x.path === 'string' && x.path.startsWith('/') ? [{ label: x.label.slice(0, 120), path: x.path.slice(0, 200) }] : []
      }).slice(0, 4)
    : []
  return {
    id: text(o.id, 20),
    title,
    lines,
    abstained: o.abstained === true,
    links,
    provenance: {
      chips: CHIPS.filter((c) => Array.isArray(p.chips) && p.chips.includes(c)),
      owner: text(p.owner, 120),
      dataTime: Number.isNaN(at) ? null : at,
      freshness,
      checkWithPerson: p.checkWithPerson === true,
      note: text(p.note, 300),
    },
  }
}

/** The card as plain text, for the thread and for anything that reads the message without drawing the card. */
export const cardText = (c: StanleyCard): string => [c.title, ...c.lines].join('\n')

/**
 * "Explain this screen": what the page is for and what to do next, from the screen id and the authored words. No server and no model, so it works offline.
 * Null when the page is not one of the app's screens.
 */
export function explainScreenCard(screenId: string | undefined): StanleyCard | null {
  const s = screenId ? SCREEN_BY_ID.get(screenId) : undefined
  if (!s) return null
  return {
    id: `explain.${s.id}`,
    title: t(s.titleKey),
    lines: [t(s.subtextKey), t('stanley.explain.screen.next')],
    abstained: false,
    links: [],
    provenance: { chips: [], owner: t('stanley.why.owner.app'), dataTime: null, freshness: 'provisional', checkWithPerson: false, note: t('stanley.why.note.written') },
  }
}

/** What put a suggestion in front of the guest: `chip` (a question under a page or an answer), `tip` (a line from Stanley on Home) `suggestion` (a prompt in the empty chat), `moment` (a card that marks something that just happened) or `story` (the diary prompt). */
export type WhyKind = 'chip' | 'tip' | 'suggestion' | 'moment' | 'story'

/**
 * "Why am I seeing this?": the fact and the rule behind a suggestion, in the same card as an answer. It is a provenance explainer, not an AI label. `fact` is what the app
 * knew (the page, the stage, the last answer); the rule is the authored wording for the kind.
 */
export function whyCard(kind: WhyKind, fact: string): StanleyCard {
  return {
    id: `why.${kind}`,
    title: t('stanley.why.title'),
    lines: [t('stanley.why.fact', { fact }), t(`stanley.why.rule.${kind}` as StringKey)],
    abstained: false,
    links: [],
    provenance: { chips: [], owner: t('stanley.why.owner.app'), dataTime: null, freshness: 'provisional', checkWithPerson: false, note: t('stanley.why.note.rule') },
  }
}
