import type { NavigateFunction } from 'react-router-dom'

import i18n from '@/i18n'
import { ApiError } from '@/services/contracts'
import { socialSignIn } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'

function extractEmailFromIdToken(idToken: string): string | undefined {
  const [, payload] = idToken.split('.')
  if (!payload) {
    return undefined
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='))
    const parsedPayload = JSON.parse(decodedPayload) as { email?: unknown }
    return typeof parsedPayload.email === 'string' ? parsedPayload.email : undefined
  } catch {
    return undefined
  }
}

export async function completeSocialAuth(
  provider: 'google' | 'apple',
  idToken: string,
  navigate: NavigateFunction,
  setErrorMessage: (value: string) => void,
): Promise<void> {
  try {
    const tokens = await socialSignIn(provider, idToken)
    await useAuthStore.getState().bootstrapAuthenticatedSession(tokens)
    navigate('/')
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      useAuthStore.getState().setIdentityCollision({
        provider,
        idToken,
        email: extractEmailFromIdToken(idToken),
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
  provider: 'google' | 'apple',
  getToken: () => Promise<string>,
  navigate: NavigateFunction,
  setErrorMessage: (value: string) => void,
): Promise<void> {
  try {
    const idToken = await getToken()
    await completeSocialAuth(provider, idToken, navigate, setErrorMessage)
  } catch {
    setErrorMessage(i18n.t('errors:providerUnavailable'))
  }
}
