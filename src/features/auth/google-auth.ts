const SDK_POLL_INTERVAL_MS = 200
const SDK_LOAD_TIMEOUT_MS = 5_000

export function renderGoogleSignInButton(
  element: HTMLElement,
  onCredential: (credential: string) => void,
  onUnavailable: () => void,
): () => void {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error('provider_unavailable')
  }

  let disposed = false

  const render = (): boolean => {
    if (disposed || !window.google?.accounts?.id?.renderButton) {
      return false
    }

    window.google.accounts.id.initialize({
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
    window.google.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: Math.max(element.clientWidth, 280),
    })

    return true
  }

  if (render()) {
    return () => {
      disposed = true
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
    window.clearInterval(intervalId)
    window.clearTimeout(timeoutId)
  }
}
