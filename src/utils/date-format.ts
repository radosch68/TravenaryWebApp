export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getTodayLocalIsoDate(): string {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parseIsoDate(isoDate))
}

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

export function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, SHORT_DATE_OPTIONS).format(date)
}

export function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    ...SHORT_DATE_OPTIONS,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatShortWeekday(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(parseIsoDate(isoDate))
}

export function formatShortMonthDay(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(parseIsoDate(isoDate))
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

// Bullet placeholder for a missing endpoint, matching the transfer estimate chip
// separator ("14 mins • 8.7 km"). Its position shows which side is empty.
const EMPTY_TIME_PLACEHOLDER = '•'

export function formatLocalTimeRange(start: string | undefined, end: string | undefined, locale: string): string {
  const formattedStart = start ? formatLocalTime(start, locale) : ''
  const formattedEnd = end ? formatLocalTime(end, locale) : ''

  // Hide the time entirely only when both ends are empty.
  if (!formattedStart && !formattedEnd) {
    return ''
  }

  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`
  }

  // Exactly one side is set: show it, with a bullet standing in for the empty end.
  return `${formattedStart || EMPTY_TIME_PLACEHOLDER} - ${formattedEnd || EMPTY_TIME_PLACEHOLDER}`
}

export function getLocalizedTimeInputPlaceholder(locale: string): string {
  return locale.startsWith('en') ? 'e.g. 2:30 PM' : 'napr. 14:30'
}
