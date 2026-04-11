import { generateClientId } from '@/utils/client-id'

const GITHUB_POPUP_TIMEOUT_MS = 120_000
const GITHUB_POPUP_POLL_MS = 300

type GithubPopupMessage = {
  source: 'travenary:github-oauth'
  code?: string
  state?: string
  error?: string
}

export async function acquireGithubAuthCode(): Promise<string> {
  const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error('provider_unavailable')
  }

  const state = generateClientId()
  const callbackUrl = new URL(`${import.meta.env.BASE_URL}oauth/github/callback`, window.location.origin)

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString())
  authorizeUrl.searchParams.set('scope', 'read:user user:email')
  authorizeUrl.searchParams.set('state', state)

  const popup = window.open(
    authorizeUrl.toString(),
    'travenary-github-oauth',
    'width=560,height=720,menubar=no,toolbar=no,status=no',
  )

  if (!popup) {
    throw new Error('provider_unavailable')
  }

  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      popup.close()
      reject(new Error('provider_unavailable'))
    }, GITHUB_POPUP_TIMEOUT_MS)

    const closedPollId = window.setInterval(() => {
      if (!popup.closed) {
        return
      }

      cleanup()
      reject(new Error('provider_unavailable'))
    }, GITHUB_POPUP_POLL_MS)

    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) {
        return
      }

      const payload = event.data as GithubPopupMessage
      if (payload?.source !== 'travenary:github-oauth') {
        return
      }

      cleanup()

      if (payload.state !== state || payload.error || !payload.code) {
        reject(new Error('provider_unavailable'))
        return
      }

      resolve(payload.code)
    }

    const cleanup = (): void => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timeoutId)
      window.clearInterval(closedPollId)
    }

    window.addEventListener('message', onMessage)
  })
}
