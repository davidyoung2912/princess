import { describe, expect, it } from 'vitest'
import { t, th } from '../i18n'
import { tabText } from '../ui/tabText'
import { actionWords } from './pageTitle'
import { JOURNEY_STAGES } from './hubs'
import { SCREEN_LIST } from './screens'
import { navTabs } from './stageNav'

const sentence = (s: string) => /^[A-Z0-9“"‘']/.test(s) && /[.!?”"')]$/.test(s)

describe('the words at the top of every page', () => {
  it('gives every screen a capitalised title and a subtext that reads as a sentence', () => {
    for (const s of SCREEN_LIST) {
      expect(th(s.titleKey), `${s.id} title`).toMatch(/^[A-Z0-9“"‘']/)
      expect(sentence(t(s.subtextKey)), `${s.id} subtext: ${t(s.subtextKey)}`).toBe(true)
    }
  })
  it('gives every tab landing page a label and a subtext at every stage', () => {
    for (const stage of JOURNEY_STAGES) for (const tab of navTabs(stage)) {
      const w = tabText(tab, stage)
      expect(w.label, `${stage}/${tab.key} label`).toMatch(/^[A-Z]/)
      expect(sentence(w.subtext), `${stage}/${tab.key} subtext: ${w.subtext}`).toBe(true)
    }
  })
  it('gives the booking pages inside an Explorer a title and a subtext of their own', () => {
    for (const [path, search] of [['/dining-today', '?reserve=new'], ['/dining-today', '?reserve=r1'], ['/spa-explorer', '?book=new'], ['/spa-explorer', '?book=a1']] as const) {
      const w = actionWords(path, search)
      expect(w, `${path}${search}`).not.toBeNull()
      expect(th(w!.title)).toMatch(/^[A-Z]/)
      expect(sentence(t(w!.subtext)), `${path}${search} subtext`).toBe(true)
    }
  })
})
