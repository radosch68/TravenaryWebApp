import { apiRequest } from '@/services/api-client'
import type { AuthTokens } from '@/services/contracts'
import { tokenService } from '@/services/token-service'

export interface SignUpRequest {
  email: string
  password: string
  displayName?: string
}

export interface SignInRequest {
  email: string
  password: string
}

export async function signUp(payload: SignUpRequest): Promise<AuthTokens> {
  return apiRequest<AuthTokens>('/auth/signup', {
    method: 'POST',
    body: payload,
  })
}

export async function signIn(payload: SignInRequest): Promise<AuthTokens> {
  return apiRequest<AuthTokens>('/auth/signin', {
    method: 'POST',
    body: payload,
  })
}

export async function signOut(): Promise<void> {
  const refreshToken = tokenService.getRefreshToken()
  if (!refreshToken) {
    return
  }

  await apiRequest<void>('/auth/revoke', {
    method: 'POST',
    body: { refreshToken },
  })
}

export async function socialSignIn(
  provider: 'google' | 'apple' | 'github',
  credential: string,
): Promise<AuthTokens> {
  return apiRequest<AuthTokens>(`/auth/oauth/${provider}`, {
    method: 'POST',
    body: provider === 'github' ? { code: credential } : { idToken: credential },
  })
}

export async function linkSocialProvider(
  provider: 'google' | 'apple' | 'github',
  credential: string,
): Promise<void> {
  await apiRequest<void>(`/auth/oauth/${provider}/link`, {
    method: 'POST',
    protected: true,
    body: provider === 'github' ? { code: credential } : { idToken: credential },
  })
}
