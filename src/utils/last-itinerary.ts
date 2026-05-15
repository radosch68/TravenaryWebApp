const LAST_ITINERARY_STORAGE_KEY_PREFIX = 'travenary_last_itinerary'

export interface RememberedItinerary {
  id: string
  title: string | null
}

function toStorageKey(email: string | null): string {
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  return `${LAST_ITINERARY_STORAGE_KEY_PREFIX}:${normalizedEmail || 'anonymous'}`
}

export function rememberLastItineraryForUser(
  email: string | null,
  itineraryId: string | null | undefined,
  itineraryTitle?: string | null,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedItineraryId = (itineraryId ?? '').trim()
  if (normalizedItineraryId.length === 0) {
    return
  }

  try {
    window.localStorage.setItem(
      toStorageKey(email),
      JSON.stringify({
        id: normalizedItineraryId,
        title: (itineraryTitle ?? '').trim() || null,
      }),
    )
  } catch {
    // Ignore localStorage write failures and keep runtime behavior.
  }
}

export function getRememberedLastItineraryForUser(email: string | null): RememberedItinerary | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(toStorageKey(email))
    const normalizedRaw = raw?.trim() ?? ''
    if (normalizedRaw.length === 0) {
      return null
    }

    // Backward compatibility: older versions stored only the itinerary id string.
    if (!normalizedRaw.startsWith('{')) {
      return { id: normalizedRaw, title: null }
    }

    const parsed = JSON.parse(normalizedRaw) as Partial<RememberedItinerary>
    const itineraryId = (parsed.id ?? '').trim()
    if (itineraryId.length === 0) {
      return null
    }

    const itineraryTitle = typeof parsed.title === 'string' && parsed.title.trim().length > 0
      ? parsed.title.trim()
      : null

    return {
      id: itineraryId,
      title: itineraryTitle,
    }
  } catch {
    return null
  }
}
