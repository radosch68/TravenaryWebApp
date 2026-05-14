export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parseIsoDate(isoDate))
}

export function formatWeekday(isoDate: string, locale: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(parseIsoDate(isoDate))
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

function parseStoredTime(value: string): Date | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return null
  }

  const date = new Date(2000, 0, 1)
  date.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return date
}

function getTimeFormatOptions(locale: string): Intl.DateTimeFormatOptions {
  if (locale === 'cs-CZ') {
    return {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  }

  if (locale.startsWith('en')) {
    return {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  }

  return {
    hour: '2-digit',
    minute: '2-digit',
  }
}

export function formatLocalTime(value: string | undefined, locale: string): string {
  if (!value) {
    return ''
  }

  const parsed = parseStoredTime(value)
  if (!parsed) {
    return value
  }

  return new Intl.DateTimeFormat(locale, getTimeFormatOptions(locale)).format(parsed)
}

export function formatLocalTimeRange(start: string | undefined, end: string | undefined, locale: string): string {
  if (!start) {
    return ''
  }

  const formattedStart = formatLocalTime(start, locale)
  if (!formattedStart) {
    return ''
  }

  const formattedEnd = end ? formatLocalTime(end, locale) : ''
  return formattedEnd ? `${formattedStart} - ${formattedEnd}` : formattedStart
}
