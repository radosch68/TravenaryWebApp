import type { ItinerarySummary } from '@/services/contracts'
import { parseIsoDate } from '@/utils/date-format'

export type FeaturedMode = 'ongoing' | 'upcoming' | 'none'

export type FeaturedItinerarySelection = {
  ongoing: ItinerarySummary | null
  upcoming: ItinerarySummary | null
  featured: ItinerarySummary | null
  mode: FeaturedMode
}

export function toValidLocalDate(value?: string): Date | null {
  if (!value) {
    return null
  }

  const parsedDate = parseIsoDate(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  parsedDate.setHours(0, 0, 0, 0)
  return parsedDate
}

function selectOngoing(itineraries: ItinerarySummary[], today: Date): ItinerarySummary | null {
  const candidates = itineraries
    .filter((itinerary) => {
      const startDate = toValidLocalDate(itinerary.startDate)
      const endDate = toValidLocalDate(itinerary.endDate)

      if (!startDate || startDate > today) {
        return false
      }

      if (endDate && endDate < today) {
        return false
      }

      return true
    })
    .sort((left, right) => {
      const leftEnd = toValidLocalDate(left.endDate)
      const rightEnd = toValidLocalDate(right.endDate)

      if (leftEnd && rightEnd) {
        return leftEnd.getTime() - rightEnd.getTime()
      }

      if (leftEnd) {
        return -1
      }

      if (rightEnd) {
        return 1
      }

      const leftStart = toValidLocalDate(left.startDate)
      const rightStart = toValidLocalDate(right.startDate)
      if (!leftStart || !rightStart) {
        return 0
      }

      return rightStart.getTime() - leftStart.getTime()
    })

  return candidates[0] ?? null
}

function selectUpcoming(itineraries: ItinerarySummary[], today: Date): ItinerarySummary | null {
  const candidates = itineraries
    .filter((itinerary) => {
      const startDate = toValidLocalDate(itinerary.startDate)
      return Boolean(startDate && startDate > today)
    })
    .sort((left, right) => {
      const leftStart = toValidLocalDate(left.startDate)
      const rightStart = toValidLocalDate(right.startDate)

      if (!leftStart || !rightStart) {
        return 0
      }

      return leftStart.getTime() - rightStart.getTime()
    })

  return candidates[0] ?? null
}

/**
 * Picks the itinerary to feature: the trip currently in progress (start <= today
 * <= end) if any, otherwise the nearest upcoming trip. Shared by the dashboard
 * widget and the post-sign-in landing-page resolver so both behave identically.
 */
export function selectFeaturedItinerary(
  itineraries: ItinerarySummary[],
  today: Date,
): FeaturedItinerarySelection {
  const ongoing = selectOngoing(itineraries, today)
  const upcoming = selectUpcoming(itineraries, today)
  const featured = ongoing ?? upcoming
  const mode: FeaturedMode = ongoing ? 'ongoing' : upcoming ? 'upcoming' : 'none'

  return { ongoing, upcoming, featured, mode }
}
