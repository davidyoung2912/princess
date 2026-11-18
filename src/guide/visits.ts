import { wasVisited, type StageProgressState } from '../routes/stageProgress'
import type { GuideView } from '../api/guideTypes'
import { applyVisits } from './view'

/** The guide with the guest's recorded visits laid over it (see `applyVisits`). */
export const withVisits = (view: GuideView, visits: StageProgressState, sailingId: string | null | undefined): GuideView =>
  applyVisits(view, (step) => wasVisited(visits, view.stage, sailingId, step))
