/**
 * The medical readiness card (S3-05): medicines (generic names), allergies, conditions, device power needs and vaccines, on one page the guest can show a ship doctor.
 * It is the guest's own card, kept on the device. Nothing here is sent to the ship or the line.
 */
export const MEDICAL_SECTIONS = ['medicines', 'allergies', 'conditions', 'devices', 'vaccines'] as const
export type MedicalSection = (typeof MEDICAL_SECTIONS)[number]

export interface MedicalCard { medicines: string[]; allergies: string[]; conditions: string[]; devices: string[]; vaccines: string[] }

export const MEDICAL_LINE_MAX = 80
export const MEDICAL_LINES_MAX = 12

export const EMPTY_MEDICAL: MedicalCard = { medicines: [], allergies: [], conditions: [], devices: [], vaccines: [] }

export const cleanMedicalLine = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, MEDICAL_LINE_MAX)

export const isMedicalSection = (v: unknown): v is MedicalSection => MEDICAL_SECTIONS.some((s) => s === v)

/** Cleans every line, drops blanks and repeats (ignoring case), and keeps at most twelve to a section. */
export function normalizeMedical(raw: unknown): MedicalCard {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const out: MedicalCard = { medicines: [], allergies: [], conditions: [], devices: [], vaccines: [] }
  for (const s of MEDICAL_SECTIONS) {
    const seen = new Set<string>()
    for (const x of Array.isArray(r[s]) ? (r[s] as unknown[]) : []) {
      const line = typeof x === 'string' ? cleanMedicalLine(x) : ''
      if (line === '' || seen.has(line.toLowerCase()) || out[s].length >= MEDICAL_LINES_MAX) continue
      seen.add(line.toLowerCase())
      out[s].push(line)
    }
  }
  return out
}

/** Adds a line to a section; returns the card unchanged when it is blank, a repeat, or the section is full. */
export function addMedicalLine(card: MedicalCard, section: MedicalSection, value: string): MedicalCard {
  const line = cleanMedicalLine(value)
  if (line === '' || card[section].length >= MEDICAL_LINES_MAX || card[section].some((l) => l.toLowerCase() === line.toLowerCase())) return card
  return { ...card, [section]: [...card[section], line] }
}

export const removeMedicalLine = (card: MedicalCard, section: MedicalSection, index: number): MedicalCard => ({ ...card, [section]: card[section].filter((_, i) => i !== index) })

export const medicalIsEmpty = (card: MedicalCard): boolean => MEDICAL_SECTIONS.every((s) => card[s].length === 0)

/** Plain text of the card; a section with nothing says so, so a blank is never read as "none". */
export function medicalText(title: string, name: string, card: MedicalCard, heading: (s: MedicalSection) => string, none: string): string {
  const lines = [title, name]
  for (const s of MEDICAL_SECTIONS) {
    lines.push('', heading(s).toUpperCase())
    if (card[s].length === 0) lines.push(none)
    else for (const l of card[s]) lines.push(`- ${l}`)
  }
  return lines.join('\n')
}
