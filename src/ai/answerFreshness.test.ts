// proves: AST-02
import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import type { StanleySource } from './stanleyRoute'

const SOURCES: readonly StanleySource[] = ['library', 'ship', 'trip', 'before', 'model']

describe('answer source and freshness labels', () => {
  it('names the source of every kind of answer', () => {
    for (const s of SOURCES) expect(t(`stanley.source.${s}` as never, { time: '9:00 AM' })).toMatch(/^From /)
  })
  it('never words a source line with the time of the reply, and says when one is not live', () => {
    for (const s of SOURCES) expect(t(`stanley.source.${s}` as never, { time: '9:00 AM' })).not.toMatch(/as of|9:00/)
    expect(t('stanley.source.library' as never)).toContain('not live')
  })
})
