import type { StringKey } from '../i18n'

/** The words of a page that is an action inside an Explorer: its title and the line under it. */
export interface ActionWords { title: StringKey; subtext: StringKey }

/**
 * The title and subtext of a page that is an action inside an Explorer (reserving, moving or booking), or null for the Explorer's own page. Those pages share their Explorer's address and
 * say what they are in the query (`?reserve=new`, `?reserve=<id>`, `?book=new`, `?book=<id>`), so the header should say "Reserve a Table", not "Dining Explorer", and say what to do here.
 */
export function actionWords(pathname: string, search: string): ActionWords | null {
  const params = new URLSearchParams(search)
  if (/^\/dining-today(\/|$)/.test(pathname)) {
    const reserve = params.get('reserve')
    if (!reserve) return null
    return reserve === 'new' ? { title: 'exp.res.newTitle', subtext: 'exp.res.newSub' } : { title: 'exp.res.moveTitle', subtext: 'exp.res.moveSub' }
  }
  if (/^\/spa-explorer(\/|$)/.test(pathname)) {
    const book = params.get('book')
    if (!book) return null
    return book === 'new' ? { title: 'spa.newTitle', subtext: 'spa.newSub' } : { title: 'spa.changeTitle', subtext: 'spa.changeSub' }
  }
  return null
}
