import { apiRequest } from '@/services/api-client'
import type { SupportedLanguage, UserProfile } from '@/services/contracts'

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
  currentPassword: string,
  newPassword: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { currentPassword, newPassword },
  })
}

export async function updatePreferredLanguage(preferredLanguage: SupportedLanguage): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    protected: true,
    body: { preferredLanguage },
  })
}

export async function deleteAccount(password?: string): Promise<void> {
  await apiRequest<void>('/users/me', {
    method: 'DELETE',
    protected: true,
    body: password ? { password } : {},
  })
}
