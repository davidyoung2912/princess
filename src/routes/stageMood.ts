import type { PoseId } from '../art/manifest'
import type { JourneyStage } from './hubs'

/** The feeling of each stage and the Stanley pose that suits it (docs/look-and-feel-recommendations.md, section 7). Plain data: the pose is a picture only, never the sole carrier of meaning. */
export interface StageMood { mood: string; pose: PoseId }

export const STAGE_MOOD: Record<JourneyStage, StageMood> = {
  dream: { mood: 'wonder', pose: 'binoculars' },
  discover: { mood: 'curiosity', pose: 'map' },
  book: { mood: 'confidence', pose: 'clipboard' },
  manage: { mood: 'organised', pose: 'clipboard' },
  prebook: { mood: 'anticipation', pose: 'think' },
  getToShip: { mood: 'focus', pose: 'suitcase' },
  embark: { mood: 'excitement', pose: 'cheer' },
  sea: { mood: 'relaxed', pose: 'umbrella' },
  port: { mood: 'adventure', pose: 'camera' },
  disembark: { mood: 'gratitude', pose: 'wave' },
  remember: { mood: 'nostalgia', pose: 'camera' },
}

export const poseForStage = (stage: JourneyStage): PoseId => STAGE_MOOD[stage].pose
