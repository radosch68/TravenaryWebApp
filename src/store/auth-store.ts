import { create } from 'zustand'

import { signOut as revokeSession } from '@/services/auth-service'
import {
  configureApiClientAuthHandlers,
  refreshSessionTokens,
} from '@/services/api-client'
import type { AuthTokens } from '@/services/contracts'
import { getMe } from '@/services/profile-service'
import { useProfileStore } from '@/store/profile-store'
import { tokenService } from '@/services/token-service'
import i18n from '@/i18n'

const LANGUAGE_KEY = 'preferredLanguage'

async function applyProfileAfterAuthentication(profile: {
  displayName?: string
  email: string
  preferredLanguage: 'en' | 'cs-CZ'
}): Promise<void> {
  useProfileStore.getState().setProfile(profile.displayName ?? null, profile.email)
  localStorage.setItem(LANGUAGE_KEY, profile.preferredLanguage)
  await i18n.changeLanguage(profile.preferredLanguage)
}

interface AuthState {
  identityCollision: {
    provider: 'google' | 'apple' | 'github'
    credential: string
    email?: string
    linkStatus: 'collision_blocked' | 'linked'
  } | null
  accessToken: string | null
  refreshToken: string | null
  expiresInSeconds: number | null
  issuedAtEpochMs: number | null
  refreshState: 'idle' | 'refreshing' | 'failed'
  restorationChecked: boolean
  setIdentityCollision: (payload: NonNullable<AuthState['identityCollision']>) => void
  clearIdentityCollision: () => void
  setSessionFromTokens: (tokens: AuthTokens) => void
  bootstrapAuthenticatedSession: (tokens: AuthTokens) => Promise<void>
  restoreSessionFromStorage: () => Promise<void>
  clearSession: () => void
  signOut: () => Promise<void>
}

function applyTokens(tokens: AuthTokens): Pick<
  AuthState,
  | 'accessToken'
  | 'refreshToken'
  | 'expiresInSeconds'
  | 'issuedAtEpochMs'
  | 'refreshState'
  | 'restorationChecked'
> {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresInSeconds: tokens.expiresIn,
    issuedAtEpochMs: Date.now(),
    refreshState: 'idle',
    restorationChecked: true,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  identityCollision: null,
  accessToken: null,
  refreshToken: null,
  expiresInSeconds: null,
  issuedAtEpochMs: null,
  refreshState: 'idle',
  restorationChecked: false,

  setIdentityCollision: (identityCollision) => {
    set({ identityCollision })
  },

  clearIdentityCollision: () => {
    set({ identityCollision: null })
  },

  setSessionFromTokens: (tokens) => {
    tokenService.setRefreshToken(tokens.refreshToken)
    tokenService.scheduleProactiveRefresh(tokens.expiresIn, () => {
      get().clearSession()
    })
    set(applyTokens(tokens))
  },

  bootstrapAuthenticatedSession: async (tokens) => {
    get().setSessionFromTokens(tokens)
    try {
      const profile = await getMe()
      await applyProfileAfterAuthentication(profile)
    } catch {
      // Non-fatal: profile data will be missing until next navigation
    }
  },

  restoreSessionFromStorage: async () => {
    const savedRefreshToken = tokenService.getRefreshToken()
    if (!savedRefreshToken) {
      set({ restorationChecked: true })
      return
    }

    set({ refreshState: 'refreshing' })
    try {
      await refreshSessionTokens()
      const profile = await getMe()
      await applyProfileAfterAuthentication(profile)
    } catch {
      get().clearSession()
    } finally {
      set({ restorationChecked: true })
    }
  },

  clearSession: () => {
    tokenService.cancelProactiveRefresh()
    tokenService.clearRefreshToken()
    useProfileStore.getState().clearProfile()

    set({
      identityCollision: null,
      accessToken: null,
      refreshToken: null,
      expiresInSeconds: null,
      issuedAtEpochMs: null,
      refreshState: 'failed',
      restorationChecked: true,
    })
  },

  signOut: async () => {
    try {
      await revokeSession()
    } finally {
      get().clearSession()
    }
  },
}))

configureApiClientAuthHandlers({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => tokenService.getRefreshToken(),
  onRefreshSuccess: (tokens) => {
    useAuthStore.getState().setSessionFromTokens(tokens)
  },
  onRefreshFailure: () => {
    useAuthStore.getState().clearSession()
  },
})
