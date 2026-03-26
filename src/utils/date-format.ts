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

export function formatDateRange(startDate: string | undefined, endDate: string | undefined, locale: string): string {
  if (!startDate && !endDate) {
    return ''
  }

  if (startDate && endDate) {
    const start = parseIsoDate(startDate)
    const end = parseIsoDate(endDate)
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    if (startYear === endYear) {
      const formatMonthDay = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' })
      const formatMonthDayYear = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', year: 'numeric' })
      return `${formatMonthDay.format(start)} – ${formatMonthDayYear.format(end)}`
    }

    return `${formatLocalDate(startDate, locale)} – ${formatLocalDate(endDate, locale)}`
  }

  return formatLocalDate((startDate || endDate) as string, locale)
}