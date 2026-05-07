import { create } from 'zustand'

interface ProfileState {
  displayName: string | null
  email: string | null
  setProfile: (displayName: string | null, email: string | null) => void
  clearProfile: () => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  displayName: null,
  email: null,
  setProfile: (displayName, email) => set({ displayName, email }),
  clearProfile: () => set({ displayName: null, email: null }),
}))
