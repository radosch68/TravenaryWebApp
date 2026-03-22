/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_ENABLE_SOCIAL_AUTH?: 'true' | 'false'
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
  readonly VITE_APPLE_OAUTH_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string
          callback: (response: { credential?: string }) => void
        }) => void
        renderButton: (parent: HTMLElement, options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'large' | 'medium' | 'small'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
          width?: number
        }) => void
        prompt: () => void
      }
    }
  }
  AppleID?: {
    auth: {
      init: (config: {
        clientId: string
        scope?: string
        usePopup?: boolean
      }) => void
      signIn: () => Promise<{ authorization?: { id_token?: string } }>
    }
  }
}
