import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'

export interface ItineraryActivitySection {
  blockIndex: number
  dividerLabel?: string
  activities: ItineraryActivity[]
}

export interface OvernightCoverage {
  status: 'covered' | 'missing' | 'multiple'
  accommodationTitle?: string
  count?: number
}

interface OvernightAccommodation {
  activity: ItineraryActivity
}

export function groupActivitiesForView(activities: ItineraryActivity[]): ItineraryActivitySection[] {
  const sections: ItineraryActivitySection[] = []
  let blockIndex = 0

  let currentActivities: ItineraryActivity[] = []
  let currentDividerLabel: string | undefined

  function flushSection(): void {
    if (currentActivities.length === 0) {
      return
    }

    sections.push({
      blockIndex,
      dividerLabel: currentDividerLabel,
      activities: currentActivities,
    })

    blockIndex += 1
    currentActivities = []
    currentDividerLabel = undefined
  }

  for (const activity of activities) {
    if (activity.type === 'divider') {
      flushSection()
      currentDividerLabel = activity.title || undefined
      continue
    }

    currentActivities.push(activity)
  }

  flushSection()

  return sections
}

export function getOvernightCoverageByGapDay(days: ItineraryDay[]): Map<number, OvernightCoverage> {
  const coverage = new Map<number, OvernightAccommodation[]>()

  days.forEach((day) => {
    day.activities.forEach((activity) => {
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
        items.push({ activity })
        coverage.set(gapDayNumber, items)
      }
    })
  })

  return new Map<number, OvernightCoverage>(
    days.slice(0, -1).map((day): [number, OvernightCoverage] => {
      const accommodations = coverage.get(day.dayNumber) ?? []

      if (accommodations.length === 1) {
        return [
          day.dayNumber,
          {
            status: 'covered',
            accommodationTitle: accommodations[0].activity.title,
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
