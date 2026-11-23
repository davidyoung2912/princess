/**
 * Card details never reach a prompt or a log (AI-SEC-06). A card number (13 to 19 digits, which may be grouped by spaces or dashes) and the code beside the words CVV, CVC or
 * security code are replaced before a message is sent. The server does the same again (`server/Princess.Api/Domain/CardData.cs`), so neither side relies on the other.
 */
export const NUMBER_MASK = '[card number removed]'
export const CODE_MASK = '[code removed]'

const NUMBER = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g
const CODE = /\b(cvv2?|cvc2?|csc|security code|card verification (?:value|code|number))\b([^\d\r\n]{0,12})\d{3,4}(?!\d)/gi

export const hasCardData = (text: string): boolean => new RegExp(NUMBER.source).test(text) || new RegExp(CODE.source, 'i').test(text)

export const redactCardData = (text: string): string => text.replace(NUMBER, NUMBER_MASK).replace(CODE, (_m, label: string, gap: string) => `${label}${gap}${CODE_MASK}`)
