import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'
import { toDayActivities } from '@/utils/tiptap-compatibility'

export interface OvernightCoverage {
  status: 'covered' | 'missing' | 'multiple'
  accommodationTitle?: string
  accommodationActivityId?: string
  accommodationDayNumber?: number
  nightNumber?: number
  totalNights?: number
  count?: number
}

export interface VirtualAccommodationCheckout {
  dayNumber: number
  sourceDayNumber: number
  sourceActivityId: string
  accommodationTitle: string
  checkOutUntil?: string
}

interface OvernightAccommodation {
  activity: ItineraryActivity
  sourceDayNumber: number
}

export function getOvernightCoverageByGapDay(days: ItineraryDay[]): Map<number, OvernightCoverage> {
  const coverage = new Map<number, OvernightAccommodation[]>()

  days.forEach((day) => {
    toDayActivities(day).forEach((activity) => {
      if (activity.type !== 'accommodation') {
        return
      }

      const nights = Math.floor(activity.details?.nights ?? 0)
      if (nights < 1) {
        return
      }

      for (let offset = 0; offset < nights; offset += 1) {
        const gapDayNumber = day.dayNumber + offset
        const items = coverage.get(gapDayNumber) ?? []
        items.push({
          activity,
          sourceDayNumber: day.dayNumber,
        })
        coverage.set(gapDayNumber, items)
      }
    })
  })

  return new Map<number, OvernightCoverage>(
    days.slice(0, -1).map((day): [number, OvernightCoverage] => {
      const accommodations = coverage.get(day.dayNumber) ?? []

      if (accommodations.length === 1) {
        const accommodation = accommodations[0]
        const totalNights = Math.max(1, Math.floor(accommodation.activity.details?.nights ?? 1))
        const nightNumber = Math.max(1, day.dayNumber - accommodation.sourceDayNumber + 1)

        return [
          day.dayNumber,
          {
            status: 'covered',
            accommodationTitle: accommodation.activity.title,
            accommodationActivityId: accommodation.activity.id,
            accommodationDayNumber: accommodation.sourceDayNumber,
            nightNumber,
            totalNights,
          },
        ]
      }

      if (accommodations.length > 1) {
        return [
          day.dayNumber,
          {
            status: 'multiple',
            count: accommodations.length,
          },
        ]
      }

      return [day.dayNumber, { status: 'missing' }]
    }),
  )
}

// Index among a day's activity tiles (in document order) before which a virtual
// checkout tile should render, so it sits chronologically by time. The checkout
// must not fall after any activity whose start OR end time is at/after the
// checkout time — i.e. an activity spanning the checkout (e.g. 10:30–11:15 vs an
// 11:11 checkout) keeps the checkout ahead of it ("better checkout early than
// late"). Since end ≥ start, each tile is compared by its end time when present,
// else its start ("HH:MM"). Untimed tiles don't anchor (skipped). A missing
// checkout time, or a checkout at/before every tile, returns 0 (render first);
// when no tile reaches the checkout, returns the tile count (render last).
export function getVirtualCheckoutActivityIndex(
  activities: ReadonlyArray<{ time?: string; timeEnd?: string }>,
  checkOutUntil?: string,
): number {
  const checkout = checkOutUntil?.trim()
  if (!checkout) {
    return 0
  }

  for (let index = 0; index < activities.length; index += 1) {
    const anchorTime = activities[index].timeEnd?.trim() || activities[index].time?.trim()
    if (anchorTime && anchorTime >= checkout) {
      return index
    }
  }

  return activities.length
}

export function getVirtualAccommodationCheckoutsByDay(
  days: ItineraryDay[],
): Map<number, VirtualAccommodationCheckout[]> {
  const dayNumbers = new Set(days.map((day) => day.dayNumber))
  const byDay = new Map<number, VirtualAccommodationCheckout[]>()

  days.forEach((day) => {
    toDayActivities(day).forEach((activity) => {
      if (activity.type !== 'accommodation') {
        return
      }

      const nights = Math.floor(activity.details?.nights ?? 0)
      if (nights < 1 || !activity.id) {
        return
      }

      const checkoutDayNumber = day.dayNumber + nights
      if (!dayNumbers.has(checkoutDayNumber)) {
        return
      }

      const items = byDay.get(checkoutDayNumber) ?? []
      items.push({
        dayNumber: checkoutDayNumber,
        sourceDayNumber: day.dayNumber,
        sourceActivityId: activity.id,
        accommodationTitle: activity.title,
        checkOutUntil: activity.details?.checkOutUntil,
      })
      byDay.set(checkoutDayNumber, items)
    })
  })

  return byDay
}
