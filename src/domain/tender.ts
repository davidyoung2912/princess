/**
 * Tender outlook (X10b): the shape of the server's reading (`GET /feeds/tender`). How likely the small boats to shore are to run late or be called
 * off at a tender port on a date. Not a forecast, and the captain decides on the day. The chance is worked out on the server.
 */
export type TenderBand = 'good' | 'mixed' | 'rough'

export interface TenderOutlook {
  port: string
  date: string
  band: TenderBand
  /** Chance of delay or cancellation, 0 to 100. */
  percent: number
  /** Text key suffixes for what a guest can do. */
  youCan: string[]
}
