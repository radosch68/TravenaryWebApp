const SDK_POLL_INTERVAL_MS = 200
const SDK_LOAD_TIMEOUT_MS = 5000

export function renderGoogleSignInButton(
  element: HTMLElement,
  onCredential: (credential: string) => void,
  onUnavailable: () => void,
  locale: string,
): () => void {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error('provider_unavailable')
  }

  let disposed = false
  let pendingRafId: number | null = null
  let pendingTimeoutId: number | null = null
  type GoogleAccountsId = NonNullable<typeof window.google>['accounts']['id']

  const doRender = (width: number, googleAccountsId: GoogleAccountsId): void => {
    googleAccountsId.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response.credential) {
          onUnavailable()
          return
        }
        onCredential(response.credential)
      },
    })

    element.innerHTML = ''
    googleAccountsId.renderButton(element, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width,
      locale,
    })
  }

  const observer = new ResizeObserver((entries) => {
    if (disposed) {
      return
    }
    const width = Math.round(entries[0]?.contentRect.width ?? 0)
    const googleAccountsId = window.google?.accounts?.id
    if (width > 0 && googleAccountsId?.renderButton) {
      doRender(width, googleAccountsId)
    }
  })
  observer.observe(element)

  const rerenderFromViewport = (): void => {
    if (disposed) {
      return
    }

    const googleAccountsId = window.google?.accounts?.id
    if (!googleAccountsId?.renderButton) {
      return
    }

    const width = Math.round(element.getBoundingClientRect().width)
    if (width > 0) {
      doRender(width, googleAccountsId)
    }
  }

  const scheduleViewportRerender = (): void => {
    if (disposed) {
      return
    }

    if (pendingRafId !== null) {
      window.cancelAnimationFrame(pendingRafId)
    }
    if (pendingTimeoutId !== null) {
      window.clearTimeout(pendingTimeoutId)
    }

    pendingRafId = window.requestAnimationFrame(() => {
      pendingRafId = null
      rerenderFromViewport()
      // Safari can report an intermediate viewport right after rotation.
      pendingTimeoutId = window.setTimeout(() => {
        pendingTimeoutId = null
        rerenderFromViewport()
      }, 280)
    })
  }

  window.addEventListener('resize', scheduleViewportRerender)
  window.addEventListener('orientationchange', scheduleViewportRerender)

  const render = (): boolean => {
    const googleAccountsId = window.google?.accounts?.id
    if (disposed || !googleAccountsId?.renderButton) {
      return false
    }

    const width = element.clientWidth
    if (width > 0) {
      doRender(width, googleAccountsId)
    }

    return true
  }

  if (render()) {
    return () => {
      disposed = true
      window.removeEventListener('resize', scheduleViewportRerender)
      window.removeEventListener('orientationchange', scheduleViewportRerender)
      observer.disconnect()
      if (pendingRafId !== null) {
        window.cancelAnimationFrame(pendingRafId)
      }
      if (pendingTimeoutId !== null) {
        window.clearTimeout(pendingTimeoutId)
      }
    }
  }

  const intervalId = window.setInterval(() => {
    if (render()) {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, SDK_POLL_INTERVAL_MS)

  const timeoutId = window.setTimeout(() => {
    window.clearInterval(intervalId)
    if (!disposed) {
      onUnavailable()
    }
  }, SDK_LOAD_TIMEOUT_MS)

  return () => {
    disposed = true
    window.removeEventListener('resize', scheduleViewportRerender)
    window.removeEventListener('orientationchange', scheduleViewportRerender)
    observer.disconnect()
    if (pendingRafId !== null) {
      window.cancelAnimationFrame(pendingRafId)
    }
    if (pendingTimeoutId !== null) {
      window.clearTimeout(pendingTimeoutId)
    }
    window.clearInterval(intervalId)
    window.clearTimeout(timeoutId)
  }
}
