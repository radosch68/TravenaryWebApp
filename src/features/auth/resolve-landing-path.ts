import type { UserProfile } from '@/services/contracts'
import { listItineraries } from '@/services/itinerary-service'
import { selectFeaturedItinerary } from '@/utils/featured-itinerary'

const DASHBOARD_PATH = '/'

function itineraryPath(itineraryId?: string): string {
  return itineraryId ? `/itineraries/${itineraryId}` : DASHBOARD_PATH
}

// Resolves the current-or-upcoming trip by fetching the user's itineraries.
// Any failure falls back to the dashboard so a flaky request never strands the
// user on an error.
async function resolveCurrentOrUpcomingPath(): Promise<string> {
  try {
    const response = await listItineraries({
      page: 1,
      limit: 100,
      sortBy: 'plannedStartDate',
      sortOrder: 'asc',
      includePast: true,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { featured } = selectFeaturedItinerary(response.items, today)
    return itineraryPath(featured?.id)
  } catch {
    return DASHBOARD_PATH
  }
}

/**
 * Decides where a user lands after a bare sign-in (deep links bypass this).
 *
 * Precedence:
 *  1. New users who haven't dismissed the About intro → /about.
 *  2. Otherwise the configured landingPage setting, resolving dynamic options
 *     to a concrete itinerary and always falling back to the dashboard when the
 *     target does not exist.
 */
export async function resolveLandingPath(profile: UserProfile): Promise<string> {
  if (!profile.onboarding?.seenAbout) {
    return '/about'
  }

  switch (profile.settings?.landingPage) {
    case 'about':
      return '/about'
    case 'itineraries':
      return '/itineraries'
    case 'ai-drafts':
      return '/ai-drafts'
    case 'last-opened-trip':
      return itineraryPath(profile.lastOpenedItinerary?.itineraryId)
    case 'current-or-upcoming-trip':
      return resolveCurrentOrUpcomingPath()
    case 'dashboard':
    default:
      return DASHBOARD_PATH
  }
}
