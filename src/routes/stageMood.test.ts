import { describe, expect, it } from 'vitest'
import { POSES } from '../art/manifest'
import { JOURNEY_STAGES } from './hubs'
import { poseForStage, STAGE_MOOD } from './stageMood'

describe('stage mood', () => {
  it('covers every stage with a pose that exists', () => {
    for (const stage of JOURNEY_STAGES) {
      expect(STAGE_MOOD[stage].mood.length).toBeGreaterThan(0)
      expect(Object.keys(POSES)).toContain(poseForStage(stage))
    }
  })
})
