export function toGoogleMapsUrl({
  coordinates,
  address,
}: {
  coordinates?: number[]
  address?: string
}): string | null {
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const [longitude, latitude] = coordinates
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    }
  }

  const normalizedAddress = address?.trim()
  if (normalizedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`
  }

  return null
}
