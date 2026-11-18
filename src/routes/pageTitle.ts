import type { StringKey } from '../i18n'

/**
 * The title of a page that is an action inside an Explorer (reserving, moving or booking), or null for the Explorer's own page. Those pages share their Explorer's address and
 * say what they are in the query (`?reserve=new`, `?reserve=<id>`, `?book=new`, `?book=<id>`), so the header should say "Reserve a table", not "Dining Explorer".
 */
export function actionTitleKey(pathname: string, search: string): StringKey | null {
  const params = new URLSearchParams(search)
  if (/^\/dining-today(\/|$)/.test(pathname)) {
    const reserve = params.get('reserve')
    return reserve ? (reserve === 'new' ? 'exp.res.newTitle' : 'exp.res.moveTitle') : null
  }
  if (/^\/spa-explorer(\/|$)/.test(pathname)) {
    const book = params.get('book')
    return book ? (book === 'new' ? 'spa.newTitle' : 'spa.changeTitle') : null
  }
  return null
}
