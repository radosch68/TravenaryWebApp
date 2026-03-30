import { create } from 'zustand'

import i18n from '@/i18n'
import {
  configureApiClientAuthHandlers,
  refreshSessionTokens,
} from '@/services/api-client'
import type { AuthTokens, UserProfile } from '@/services/contracts'
import { getMe } from '../services/profile-service'
import { tokenService } from '@/services/token-service'
import { useProfileStore } from '@/store/profile-store'

export interface AuthProviderIdentity {
  provider: 'google' | 'apple' | 'github'
  credential: string
  email?: string
  linkStatus: 'collision_blocked' | 'linked'
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresInSeconds: number | null
  issuedAtEpochMs: number | null
  refreshState: 'idle' | 'refreshing' | 'failed'
  identityCollision: AuthProviderIdentity | null
  restorationChecked: boolean
  setIdentityCollision: (payload: AuthProviderIdentity) => void
  clearIdentityCollision: () => void
  setSessionFromTokens: (tokens: AuthTokens) => void
  bootstrapAuthenticatedSession: (tokens: AuthTokens) => Promise<void>
  restoreSessionFromStorage: () => Promise<void>
  clearSession: () => void
}

function applyTokens(tokens: AuthTokens): Omit<AuthState, 'setIdentityCollision' | 'clearIdentityCollision' | 'setSessionFromTokens' | 'bootstrapAuthenticatedSession' | 'restoreSessionFromStorage' | 'clearSession'> {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresInSeconds: tokens.expiresIn,
    issuedAtEpochMs: Date.now(),
    refreshState: 'idle',
    identityCollision: null,
    restorationChecked: true,
  }
}

async function applyAuthenticatedProfile(profile: UserProfile): Promise<void> {
  useProfileStore.getState().applyAuthenticatedProfile(profile)
  await i18n.changeLanguage(profile.preferredLanguage)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  expiresInSeconds: null,
  issuedAtEpochMs: null,
  refreshState: 'idle',
  identityCollision: null,
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
      window.location.assign(`${import.meta.env.BASE_URL}signin`)
    })
    set(applyTokens(tokens))
  },

  bootstrapAuthenticatedSession: async (tokens) => {
    get().setSessionFromTokens(tokens)
    const profile = await getMe()
    await applyAuthenticatedProfile(profile)
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
      await applyAuthenticatedProfile(profile)
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
      accessToken: null,
      refreshToken: null,
      expiresInSeconds: null,
      issuedAtEpochMs: null,
      refreshState: 'failed',
      identityCollision: null,
      restorationChecked: true,
    })
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
