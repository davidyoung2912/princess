// A test helper, not a gate: with STANLEY_EXPORT set to a file saved from "Copy unanswered questions" it prints what to author next.
// Usage: STANLEY_EXPORT=path/to/export.json npm run stanley:misses
import { readFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { parseUnanswered } from '../../diagnostics/stanleyUnanswered'
import { analyseMisses, reportText } from './misses'

const file = process.env.STANLEY_EXPORT

describe.skipIf(!file)('unanswered question report', () => {
  it('prints the report', () => {
    console.log(`\n${reportText(analyseMisses(parseUnanswered(readFileSync(file!, 'utf8')).map((q) => q.text)))}`)
  })
})
