import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ThirdPartyChip } from './ThirdPartyChip'

describe('third-party chip', () => {
  it('names the credit', () => {
    expect(renderToString(<ThirdPartyChip credit="GoVisit" />)).toContain('GoVisit')
  })
})
