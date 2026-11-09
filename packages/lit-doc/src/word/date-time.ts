/**
 * Decodes source minute-resolution calendar bits without normalizing invalid dates or inventing a zone.
 * @param raw - Original unsigned DTTM bits.
 * @returns Floating ISO minute carrier, undefined for an ignored date, or null for an invalid active date.
 */
export function readFloatingDttm(raw: number): string | undefined | null {
  const minute = raw & 63, hour = raw >>> 6 & 31, day = raw >>> 11 & 31
  const month = raw >>> 16 & 15, year = (raw >>> 20 & 511) + 1900, weekday = raw >>> 29
  if (!day || !month) return undefined
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (minute > 59 || hour > 23 || month > 12 || day > days[month - 1]! || weekday > 6) return null
  /** @param value - Calendar component. @returns Two-digit ISO component. */
  function two(value: number): string { return String(value).padStart(2, '0') }
  return `${year}-${two(month)}-${two(day)}T${two(hour)}:${two(minute)}:00`
}
