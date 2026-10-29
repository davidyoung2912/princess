import type { StringKey } from '../i18n'

/** For every top task, how to do it without the app (INC-01): a desk, a phone number or a paper copy. Keyed by the task ids in `routes/nav.ts`. */
export const ALTERNATIVES: Readonly<Record<string, StringKey>> = {
  boardingPass: 'alt.boardingPass',
  todaysEvents: 'alt.todaysEvents',
  myReservations: 'alt.myReservations',
  orderFood: 'alt.orderFood',
  askForHelp: 'alt.askForHelp',
  myBill: 'alt.myBill',
  deckMap: 'alt.deckMap',
  guestServices: 'alt.guestServices',
  changeDining: 'alt.changeDining',
  findFamily: 'alt.findFamily',
  addPackage: 'alt.addPackage',
  allAboard: 'alt.allAboard',
  emergencyInfo: 'alt.emergencyInfo',
  myExcursions: 'alt.myExcursions',
  textSize: 'alt.textSize',
}
