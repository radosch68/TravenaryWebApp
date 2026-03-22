import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { renderGoogleSignInButton } from '@/features/auth/google-auth'

interface GoogleSignInButtonProps {
  onIdToken: (idToken: string) => Promise<void>
}

export function GoogleSignInButton({ onIdToken }: GoogleSignInButtonProps): ReactElement {
  const { t } = useTranslation('errors')
  const hasClientId = Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const buttonContainerRef = useRef<HTMLDivElement | null>(null)
  const onIdTokenRef = useRef(onIdToken)
  const [loadError, setLoadError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    onIdTokenRef.current = onIdToken
  }, [onIdToken])

  useEffect(() => {
    if (!hasClientId) {
      return
    }

    const container = buttonContainerRef.current
    if (!container) {
      return
    }

    return renderGoogleSignInButton(
      container,
      (idToken) => {
        setLoadError(false)
        setIsSubmitting(true)
        void onIdTokenRef.current(idToken).finally(() => {
          setIsSubmitting(false)
        })
      },
      () => {
        setLoadError(true)
      },
    )
  }, [hasClientId])

  if (!hasClientId || loadError) {
    return <p className="error">{t('providerUnavailable')}</p>
  }

  return <div aria-busy={isSubmitting} ref={buttonContainerRef} />
}