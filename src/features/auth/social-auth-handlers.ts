import type { NavigateFunction } from 'react-router-dom'

import { resolveLandingPath } from '@/features/auth/resolve-landing-path'
import i18n from '@/i18n'
import { socialSignIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

function extractEmailFromJwtCredential(credential: string): string | undefined {
  const [, payload] = credential.split('.')
  if (!payload) {
    return undefined
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = window.atob(
      normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='),
    )
    const parsedPayload = JSON.parse(decodedPayload) as { email?: unknown }
    return typeof parsedPayload.email === 'string' ? parsedPayload.email : undefined
  } catch {
    return undefined
  }
}

export async function completeSocialAuth(
  provider: 'google' | 'apple' | 'github',
  credential: string,
  navigate: NavigateFunction,
  setErrorMessage: (value: string) => void,
): Promise<void> {
  try {
    const tokens = await socialSignIn(provider, credential)
    const profile = await useAuthStore.getState().bootstrapAuthenticatedSession(tokens)
    navigate(profile ? await resolveLandingPath(profile) : '/')
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      useAuthStore.getState().setIdentityCollision({
        provider,
        credential,
        email: provider === 'github' ? undefined : extractEmailFromJwtCredential(credential),
        linkStatus: 'collision_blocked',
      })
      navigate('/link-provider')
      return
    }

    if (error instanceof ApiError && error.status === 401) {
      setErrorMessage(i18n.t('auth:errors.invalidCredentials'))
      return
    }

    setErrorMessage(i18n.t('errors:providerUnavailable'))
  }
}

export async function handleSocialAuth(
  provider: 'google' | 'apple' | 'github',
  getToken: () => Promise<string>,
  navigate: NavigateFunction,
  setErrorMessage: (value: string) => void,
): Promise<void> {
  try {
    const credential = await getToken()
    await completeSocialAuth(provider, credential, navigate, setErrorMessage)
  } catch {
    setErrorMessage(i18n.t('errors:providerUnavailable'))
  }
}
