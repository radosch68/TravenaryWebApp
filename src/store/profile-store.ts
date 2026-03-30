import { create } from 'zustand'

import type { SupportedLanguage, UserProfile } from '@/services/contracts'

interface ProfileState {
  profile: UserProfile | null
  activeLanguage: SupportedLanguage
  setProfile: (profile: UserProfile | null) => void
  applyAuthenticatedProfile: (profile: UserProfile) => void
  setActiveLanguage: (value: SupportedLanguage, options?: { persist?: boolean }) => void
  clearProfile: () => void
}

const LANGUAGE_KEY = 'preferredLanguage'

function normalizeSupportedLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'cs-CZ' ? 'cs-CZ' : 'en'
}

function getInitialLanguage(): SupportedLanguage {
  return normalizeSupportedLanguage(localStorage.getItem(LANGUAGE_KEY))
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  activeLanguage: getInitialLanguage(),
  setProfile: (profile) => {
    set({ profile })
  },
  applyAuthenticatedProfile: (profile) => {
    const nextLanguage = normalizeSupportedLanguage(profile.preferredLanguage)
    localStorage.setItem(LANGUAGE_KEY, nextLanguage)
    set({ profile, activeLanguage: nextLanguage })
  },
  setActiveLanguage: (activeLanguage, options) => {
    const normalizedLanguage = normalizeSupportedLanguage(activeLanguage)
    if (options?.persist !== false) {
      localStorage.setItem(LANGUAGE_KEY, normalizedLanguage)
    }
    set({ activeLanguage: normalizedLanguage })
  },
  clearProfile: () => {
    set({ profile: null })
  },
}))
