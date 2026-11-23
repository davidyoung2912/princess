import type { PoseId } from '../../shared/art/manifest'
import type { JourneyStage } from './hubs'

/** The feeling of each stage and the Stanley pose that suits it (docs/look-and-feel-recommendations.md, section 7). Plain data: the pose is a picture only, never the sole carrier of meaning. */
export interface StageMood { mood: string; pose: PoseId }

export const STAGE_MOOD: Record<JourneyStage, StageMood> = {
  dream: { mood: 'wonder', pose: 'binoculars' },
  discover: { mood: 'curiosity', pose: 'map' },
  book: { mood: 'confidence', pose: 'planning' },
  manage: { mood: 'organised', pose: 'checklist' },
  prebook: { mood: 'anticipation', pose: 'countdown' },
  getToShip: { mood: 'focus', pose: 'passport' },
  embark: { mood: 'excitement', pose: 'cheer' },
  sea: { mood: 'relaxed', pose: 'poolside' },
  port: { mood: 'adventure', pose: 'port-visit' },
  disembark: { mood: 'gratitude', pose: 'wave' },
  remember: { mood: 'nostalgia', pose: 'camera' },
}

export const poseForStage = (stage: JourneyStage): PoseId => STAGE_MOOD[stage].pose
