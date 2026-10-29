import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from './contacts'
import { musterByLabel, type MusterStation } from './deck'

/** Muster drill and the emergency card (SAF-01, SAF-02). The drill time and wording are authored concept values (verify before real use). */
export const DRILL = { day: 1, time: '14:00', minutes: 30 } as const

export const MEDICAL_NUMBER = '555-0112'
/** Dialled from a cabin phone. */
export const CABIN_EMERGENCY = '911'

export const DRILL_STEPS = ['listen', 'station', 'checkin', 'jacket', 'wait'] as const
export type DrillStep = (typeof DRILL_STEPS)[number]

export interface DrillLanguage { code: string; name: string; /** Four short lines, in the order: go, bring, check in, wait. */ lines: readonly [string, string, string, string] }

/** The drill's key points in the languages the ship announces in. Written for the concept; a real ship uses its approved safety text. */
export const DRILL_LANGUAGES: readonly DrillLanguage[] = [
  { code: 'en', name: 'English', lines: ['Go to your muster station when you hear seven short blasts and one long.', 'Bring your boarding pass and any medicine you need. Leave bags in your stateroom.', 'Show your pass to a crew member to check in.', 'Stay at the station until the crew say the drill is over.'] },
  { code: 'es', name: 'Español', lines: ['Vaya a su puesto de reunión cuando oiga siete pitidos cortos y uno largo.', 'Lleve su tarjeta de embarque y los medicamentos que necesite. Deje el equipaje en el camarote.', 'Muestre su tarjeta a un miembro de la tripulación para registrarse.', 'Permanezca en el puesto hasta que la tripulación indique que el simulacro ha terminado.'] },
  { code: 'fr', name: 'Français', lines: ['Rendez-vous à votre poste de rassemblement au signal de sept coups brefs et un long.', 'Apportez votre carte d’embarquement et vos médicaments. Laissez vos bagages dans la cabine.', 'Présentez votre carte à un membre d’équipage pour vous enregistrer.', 'Restez au poste jusqu’à la fin de l’exercice annoncée par l’équipage.'] },
  { code: 'de', name: 'Deutsch', lines: ['Gehen Sie bei sieben kurzen und einem langen Signalton zu Ihrer Sammelstelle.', 'Nehmen Sie Bordkarte und nötige Medikamente mit. Lassen Sie Gepäck in der Kabine.', 'Zeigen Sie Ihre Karte einem Besatzungsmitglied zum Einchecken.', 'Bleiben Sie, bis die Besatzung das Ende der Übung bekannt gibt.'] },
  { code: 'zh', name: '中文', lines: ['听到七短一长的警报声后，请前往您的集合站。', '请携带登船卡和必需药品，行李留在客舱。', '向船员出示登船卡以登记。', '请留在集合站，直到船员宣布演习结束。'] },
]

export type MusterNeed = 'mobility' | 'hearing' | 'vision' | 'cognitive' | 'young'

/** Ways to take part when the usual way does not work (SAF-01 accessible alternatives). */
export const DRILL_ALTERNATIVES: readonly MusterNeed[] = ['mobility', 'hearing', 'vision', 'cognitive', 'young']

export interface Contact { label: string; number: string; note: string }

export const EMERGENCY_CONTACTS: readonly Contact[] = [
  { label: 'cabin', number: CABIN_EMERGENCY, note: 'From any cabin or ship phone' },
  { label: 'mobile', number: EMERGENCY_NUMBER, note: 'From your own phone on the ship’s network' },
  { label: 'medical', number: MEDICAL_NUMBER, note: 'Medical Center, Deck 4 forward' },
  { label: 'guestServices', number: GUEST_SERVICES_NUMBER, note: 'Guest Services, Deck 6 forward' },
]

/** Medical Center hours: longer on a sea day, when more guests are aboard (SAF-03 hours by day type). */
export const MEDICAL_HOURS = { sea: [['08:00', '12:00'], ['15:00', '19:00']], port: [['08:00', '10:00'], ['17:30', '19:30']] } as const

export interface EmergencyCard {
  guest: string
  stateroom: string
  deck: number
  muster: string
  musterPlace: MusterStation | null
  contacts: readonly Contact[]
  /** What to say, so a stressed guest can read it aloud. */
  script: string
}

/** The card a guest keeps offline: stateroom, station, who to call, and the words to say. */
export function emergencyCard(guest: string, stateroom: string, deck: number, muster: string): EmergencyCard {
  return {
    guest, stateroom, deck, muster, musterPlace: musterByLabel(muster), contacts: EMERGENCY_CONTACTS,
    script: `This is ${guest}. I need help in stateroom ${stateroom}, deck ${deck}.`,
  }
}

/** Whether a stored card is whole enough to show (it can come back from an old copy on the phone). */
export function isEmergencyCard(v: unknown): v is EmergencyCard {
  const o = v as Partial<EmergencyCard> | null
  return !!o && typeof o.guest === 'string' && typeof o.stateroom === 'string' && typeof o.deck === 'number' && typeof o.muster === 'string' && typeof o.script === 'string' && Array.isArray(o.contacts)
}
