import type { JourneyStage } from '../../routes/hubs'

/**
 * One authored question and answer (docs/experience-extension-ideas.md section 13.5). The words live in the locale files under
 * `stanley.q.<id>` and `stanley.a.<id>`, so a translation never touches this code. Showing one costs nothing: no model is called.
 */
export interface LibraryEntry {
  id: string
  /** The stages the entry is a default chip for, when its screen is not named. */
  stages: readonly JourneyStage[]
  /** Screen ids the entry suits best; on one of these screens it comes before the stage's general entries. */
  screens: readonly string[]
  /** A static path the answer can point to ("Show me"), when there is a good one. */
  link?: string
  /** Screen ids of related pages, offered as links under the answer so the guest can see where else in the app to look. */
  related?: readonly string[]
  /** Extra words a guest might type for this question, used only to match free text. */
  words?: string
}
