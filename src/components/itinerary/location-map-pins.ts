import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'

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

export function buildLocationMapPinsFromActivities(
  activities: ItineraryActivity[],
  idPrefix = '',
  dayNumber?: number,
): LocationMapPin[] {
  const pins: LocationMapPin[] = []
  const resolvedPrefix = idPrefix ? `${idPrefix}-` : ''

  for (const activity of activities) {
    const locations = activity.locations ?? []

    locations.forEach((location, locationIndex) => {
      if (!location.showOnMap || !hasCoordinates(location.coordinates)) {
        return
      }

      const [longitude, latitude] = location.coordinates
      pins.push({
        id: `${resolvedPrefix}${activity.id}-${locationIndex}`,
        longitude,
        latitude,
        dayNumber,
        activityType: activity.type,
        activityTitle: activity.title,
        activityTime: activity.time,
        locationLabel: location.caption?.trim(),
      })
    })
  }

  return pins
}

export function buildLocationMapPinsFromDays(days: ItineraryDay[]): LocationMapPin[] {
  const pins: LocationMapPin[] = []

  for (const day of days) {
    pins.push(...buildLocationMapPinsFromActivities(day.activities, `day${day.dayNumber}`, day.dayNumber))
  }

  return pins
}

export function buildGoogleMapsSearchUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
}