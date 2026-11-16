import type { HoursDay } from '../../api/explorerTypes'
import { formatTime } from '../../domain/cruise'
import { t } from '../../i18n'

/** "5:30 PM to 9:30 PM, 7:00 AM to 9:30 AM" for a venue's windows, or nothing for a day with none. */
export const windowsText = (hours: HoursDay): string => spanText(hours.windows)

/** The staffed windows of a venue that is open longer than it is staffed (a 24-hour gym), or nothing when they match the opening hours. */
export const staffedText = (hours: HoursDay): string => (JSON.stringify(hours.staffed) === JSON.stringify(hours.windows) ? '' : spanText(hours.staffed))

const spanText = (windows: HoursDay['windows']): string => windows.map(([a, b]) => `${formatTime(a)} to ${b === '24:00' ? t('exp.hours.midnight') : formatTime(b)}`).join(', ')
