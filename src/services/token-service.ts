import { refreshSessionTokens } from '@/services/api-client'

const REFRESH_TOKEN_KEY = 'refreshToken'

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | undefined

export const tokenService = {
  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  clearRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  scheduleProactiveRefresh(expiresInSeconds: number): void {
    tokenService.cancelProactiveRefresh()

    const triggerInMs = Math.max(0, (expiresInSeconds - 30) * 1000)
    proactiveRefreshTimer = setTimeout(() => {
      // Definitive rejections clear the session via the configured auth
      // handlers; transient failures keep it so the on-401 retry can recover.
      void refreshSessionTokens().catch(() => undefined)
    }, triggerInMs)
  },

  cancelProactiveRefresh(): void {
    if (proactiveRefreshTimer) {
      clearTimeout(proactiveRefreshTimer)
      proactiveRefreshTimer = undefined
    }
  },
}
