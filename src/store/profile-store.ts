import { create } from 'zustand'
import type { LastOpenedItinerary } from '@/services/contracts'

interface ProfileState {
  displayName: string | null
  email: string | null
  lastOpenedItinerary: LastOpenedItinerary | null
  setProfile: (
    displayName: string | null,
    email: string | null,
    lastOpenedItinerary?: LastOpenedItinerary | null,
  ) => void
  clearProfile: () => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  displayName: null,
  email: null,
  lastOpenedItinerary: null,
  setProfile: (displayName, email, lastOpenedItinerary) =>
    set({
      displayName,
      email,
      lastOpenedItinerary: lastOpenedItinerary ?? null,
    }),
  clearProfile: () => set({ displayName: null, email: null, lastOpenedItinerary: null }),
}))
