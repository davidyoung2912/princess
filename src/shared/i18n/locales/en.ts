import { enCore } from './enCore'
import { enRest } from './enRest'
import { enLate } from './enLate'
import { enAnswers } from './enAnswers'

/** Every English string, for types and tests. The app itself loads `enCore` at start and `enRest`, `enLate` and `enAnswers` just after (`i18n/index.ts`), so it does not import this value. */
export const en = { ...enCore, ...enRest, ...enLate, ...enAnswers } as const

export type StringKey = Exclude<keyof typeof en, `${string}_one` | `${string}_other`> | PluralBase<keyof typeof en>

type PluralBase<K> = K extends `${infer B}_one` | `${infer B}_other` ? B : never
