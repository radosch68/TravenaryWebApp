import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import styles from './AuthPage.module.css'

export function GithubOAuthCallbackPage(): ReactElement {
  const { t } = useTranslation(['auth'])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    window.opener?.postMessage(
      {
        source: 'travenary:github-oauth',
        code: params.get('code') ?? undefined,
        state: params.get('state') ?? undefined,
        error: params.get('error') ?? undefined,
      },
      window.location.origin,
    )

    window.close()
  }, [])

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <p role="status" aria-live="polite" className={styles.subtitle}>
          {t('auth:social.oauthCallback')}
        </p>
      </section>
    </main>
  )
}
