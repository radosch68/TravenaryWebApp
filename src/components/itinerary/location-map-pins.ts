import type { ActivityLocation, ItineraryActivity, ItineraryDay } from '@/services/contracts'
import { toDayActivities } from '@/utils/tiptap-compatibility'

export interface LocationMapPin {
  id: string
  longitude: number
  latitude: number
  dayNumber?: number
  activityType: ItineraryActivity['type']
  activityTitle: string
  activityTime?: string
  locationLabel?: string
}

export function hasCoordinates(coordinates?: number[]): coordinates is [number, number] {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false
  }

  const [longitude, latitude] = coordinates
  return (
    Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90
  )
}

// Every map-eligible location an activity contributes, each tagged with a
// stable key for pin ids. A transfer keeps its endpoints in `details.from`/
// `details.to` (not in `locations[]`), so they must be folded in explicitly or
// a map-flagged transfer endpoint would never become a pin.
function collectActivityMapLocations(activity: ItineraryActivity): Array<{ location: ActivityLocation; key: string }> {
  const collected = (activity.locations ?? []).map((location, index) => ({ location, key: String(index) }))

  if (activity.type === 'transfer') {
    const { from, to } = activity.details ?? {}
    if (from) {
      collected.push({ location: from, key: 'from' })
    }
    if (to) {
      collected.push({ location: to, key: 'to' })
    }
  }

  return collected
}

export function activityHasMapPin(activity: ItineraryActivity): boolean {
  return collectActivityMapLocations(activity).some(
    ({ location }) => location.showOnMap === true && hasCoordinates(location.coordinates),
  )
}

export function buildLocationMapPinsFromActivities(
  activities: ItineraryActivity[],
  idPrefix = '',
  dayNumber?: number,
): LocationMapPin[] {
  const pins: LocationMapPin[] = []
  const resolvedPrefix = idPrefix ? `${idPrefix}-` : ''

  for (const activity of activities) {
    for (const { location, key } of collectActivityMapLocations(activity)) {
      if (!location.showOnMap || !hasCoordinates(location.coordinates)) {
        continue
      }

      const [longitude, latitude] = location.coordinates
      pins.push({
        id: `${resolvedPrefix}${activity.id}-${key}`,
        longitude,
        latitude,
        dayNumber,
        activityType: activity.type,
        activityTitle: activity.title,
        activityTime: activity.time,
        locationLabel: location.caption?.trim(),
      })
    }
  }

  return pins
}

export function buildLocationMapPinsFromDays(days: ItineraryDay[]): LocationMapPin[] {
  const pins: LocationMapPin[] = []

  for (const day of days) {
    pins.push(...buildLocationMapPinsFromActivities(toDayActivities(day), `day${day.dayNumber}`, day.dayNumber))
  }

  return pins
}

export function buildGoogleMapsSearchUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
}