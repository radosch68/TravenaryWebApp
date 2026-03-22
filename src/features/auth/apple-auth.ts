export async function acquireAppleIdToken(): Promise<string> {
  const clientId = import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error('provider_unavailable')
  }

  if (!window.AppleID?.auth) {
    throw new Error('provider_unavailable')
  }

  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    usePopup: true,
  })

  const result = await window.AppleID.auth.signIn()
  const token = result.authorization?.id_token

  if (!token) {
    throw new Error('provider_unavailable')
  }

  return token
}
