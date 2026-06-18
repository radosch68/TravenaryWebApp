import { apiRequest } from '@/services/api-client'
import type { LandingPageOption, SupportedLanguage, UserProfile } from '@/services/contracts'

export async function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    protected: true,
  })
}

export async function updateDisplayName(displayName: string): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { displayName },
  })
}

export async function changePassword(
  currentPassword: string | undefined,
  newPassword: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: currentPassword ? { currentPassword, newPassword } : { newPassword },
  })
}

export async function updatePreferredLanguage(
  preferredLanguage: SupportedLanguage,
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { preferredLanguage },
  })
}

export async function updateLastOpenedItinerary(
  lastOpenedItineraryId: string | null,
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { lastOpenedItineraryId },
  })
}

export async function updateLandingPage(
  landingPage: LandingPageOption,
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { landingPage },
  })
}

// Idempotent, fire-and-forget: records that the user dismissed the About intro.
// Failures are non-critical (worst case the intro shows once more), so callers
// should not block UI or surface errors on rejection.
export async function markAboutSeen(): Promise<void> {
  await apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { seenAbout: true },
  })
}

export async function deleteAccount(password?: string): Promise<void> {
  await apiRequest<void>('/users/me', {
    method: 'DELETE',
    protected: true,
    body: password ? { password } : {},
  })
}
