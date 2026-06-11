import { parseIsoDate } from '@/utils/date-format'

export type OngoingProgress = {
  totalHours: number
  hoursLeft: number
  elapsedPercent: number
}

export function getUpcomingDaysLeft(startDate: string | undefined, todayIsoDate: string): number | null {
  if (!startDate || startDate <= todayIsoDate) {
    return null
  }

  const [todayYear, todayMonth, todayDay] = todayIsoDate.split('-').map(Number)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  const difference = Math.floor((startUtc - todayUtc) / millisecondsPerDay)
  return difference > 0 ? difference : null
}

export function getOngoingProgress(
  startDate: string | undefined,
  endDate: string | undefined,
  dayCount: number,
  nowDate: Date,
): OngoingProgress | null {
  if (!startDate || !endDate || dayCount <= 0) {
    return null
  }

  const start = parseIsoDate(startDate)
  const endExclusive = parseIsoDate(endDate)
  start.setHours(0, 0, 0, 0)
  endExclusive.setHours(0, 0, 0, 0)
  endExclusive.setDate(endExclusive.getDate() + 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return null
  }

  if (nowDate < start || nowDate >= endExclusive) {
    return null
  }

  const totalHours = dayCount * 24
  const millisecondsPerHour = 60 * 60 * 1000
  const rawHoursLeft = (endExclusive.getTime() - nowDate.getTime()) / millisecondsPerHour
  const hoursLeft = Math.max(0, Math.min(totalHours, Math.ceil(rawHoursLeft)))
  const elapsedHours = Math.max(0, totalHours - hoursLeft)
  const elapsedPercent = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  return {
    totalHours,
    hoursLeft,
    elapsedPercent,
  }
}
