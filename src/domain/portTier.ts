import { PORT_KNOWLEDGE, type PortKnowledge } from './portContent'
import { portGuideById, type PortGuide } from './ports'
import { portById } from './sailings'

/**
 * Which guide a port gets (X0g). `full` has the authored guide and port knowledge (prices, scams, phrases, walks), `short` has a guide or is a
 * Tier B port and shows the facts the catalogue holds, `link` is the fallback for everything else. A port id that is not known at all is `link`.
 * The screens never refuse a port id: they show the level they have and say plainly when a guide is not written yet.
 */
export type GuideLevel = 'full' | 'short' | 'link'

export const knowledgeOf = (id: string): PortKnowledge | undefined => (Object.prototype.hasOwnProperty.call(PORT_KNOWLEDGE, id) ? (PORT_KNOWLEDGE as Record<string, PortKnowledge>)[id] : undefined)

export function guideLevelOf(id: string): GuideLevel {
  if (knowledgeOf(id)) return 'full'
  if (portGuideById(id) || portById(id)?.tier === 'B') return 'short'
  return 'link'
}

/** The facts the catalogue holds for a port, as plain lines for the short and link levels. Empty when the port is unknown. */
export function portFacts(id: string): { label: 'country' | 'currency' | 'languages' | 'landing' | 'region'; value: string }[] {
  const p = portById(id)
  if (!p) return []
  const out: { label: 'country' | 'currency' | 'languages' | 'landing' | 'region'; value: string }[] = []
  if (p.country) out.push({ label: 'country', value: p.country })
  if (p.currency) out.push({ label: 'currency', value: p.currency })
  if (p.languages?.length) out.push({ label: 'languages', value: p.languages.join(', ') })
  out.push({ label: 'landing', value: p.tender ? 'tender' : 'pier' })
  return out
}

/** The ports to offer in a picker: the sailing's own ports first (in order, once each), then the ports that have a full guide. Ports the catalogue does not know are left out. */
export function guidePickerPorts(sailingPortIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...sailingPortIds, ...Object.keys(PORT_KNOWLEDGE)]) {
    if (id === 'sea' || seen.has(id) || !portById(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** The short text for the port snapshot when there is no authored knowledge: only what the catalogue holds, with no prices or advice made up. */
export function shortSnapshot(id: string): string[] {
  const g: PortGuide | undefined = portGuideById(id)
  const p = portById(id)
  if (!p) return []
  return [
    ...(g ? [g.blurb] : []),
    ...portFacts(id).map((f) => `${f.label[0]!.toUpperCase()}${f.label.slice(1)}: ${f.value}`),
    'Local prices and safety notes are not written for this port yet. Check with the ship\'s shore excursions desk.',
  ]
}
