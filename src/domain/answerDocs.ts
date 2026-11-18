import { FAQS } from './help'
import type { AnswerDoc } from './searchIndex'

/** A written answer for the search page, from the help centre or from Stanley's library. `source` says which, and `link` is where the guest can go to do the thing. */
export interface SearchAnswer extends AnswerDoc { source: 'help' | 'stanley'; answer: string; /** Where the answer was written for, when it belongs to one screen. */ caption?: string; link?: { to: string; label: string } }

/** The help centre's questions as search answers. */
export const helpAnswers = (): SearchAnswer[] => FAQS.map((f) => ({ id: `help:${f.id}`, source: 'help', question: f.question, answer: f.answer, text: f.answer, link: f.link }))
