import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { renderGoogleSignInButton } from '@/features/auth/google-auth'

import styles from '@/pages/AuthPage.module.css'

interface GoogleSignInButtonProps {
  onIdToken: (idToken: string) => Promise<void>
}

export function GoogleSignInButton({ onIdToken }: GoogleSignInButtonProps): ReactElement {
  const { t, i18n } = useTranslation(['errors'])
  const hasClientId = Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const buttonContainerRef = useRef<HTMLDivElement | null>(null)
  const onIdTokenRef = useRef(onIdToken)
  const [loadError, setLoadError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sdkLocale = i18n.resolvedLanguage?.toLowerCase().startsWith('cs') ? 'cs' : 'en'

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
      sdkLocale,
    )
  }, [hasClientId, sdkLocale])

  if (!hasClientId || loadError) {
    return <p className={styles.error}>{t('errors:providerUnavailable')}</p>
  }

  return <div aria-busy={isSubmitting} ref={buttonContainerRef} className={styles.googleSigninBtn} />
}
