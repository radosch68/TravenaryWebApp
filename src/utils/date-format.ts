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

export function getLocalizedTimeInputPlaceholder(locale: string): string {
  return locale.startsWith('en') ? 'e.g. 2:30 PM' : 'napr. 14:30'
}
