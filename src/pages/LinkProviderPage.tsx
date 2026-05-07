import type { FormEvent, ReactElement } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { linkSocialProvider, signIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

import styles from './AuthPage.module.css'

export function LinkProviderPage(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth'])
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const collision = useAuthStore((state) => state.identityCollision)
  const clearIdentityCollision = useAuthStore((state) => state.clearIdentityCollision)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const prefilledEmail = collision?.email ?? ''

  const providerLabel = collision
    ? t(`auth:providers.${collision.provider}`)
    : t('auth:providers.google')

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!collision) {
      navigate('/signin')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    try {
      const tokens = await signIn({ email: prefilledEmail || email, password })
      await bootstrapAuthenticatedSession(tokens)
      await linkSocialProvider(collision.provider, collision.credential)
      clearIdentityCollision()
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setApiError(t('auth:errors.invalidCredentials'))
      } else {
        setApiError(t('auth:errors.linkFailed'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function onCancel(): void {
    clearIdentityCollision()
    navigate('/signin')
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <h1 className={styles.title}>{t('auth:link.title')}</h1>
        <p className={styles.subtitle}>{t('auth:link.subtitle', { provider: providerLabel })}</p>
        <p className={styles.subtitle}>
          {collision?.email
            ? t('auth:link.emailPrefilled', { email: collision.email, provider: providerLabel })
            : t('auth:link.emailUnknown', { provider: providerLabel })}
        </p>

        <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              {t('auth:fields.email')}
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              readOnly={Boolean(collision?.email)}
              required
              value={prefilledEmail || email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              {t('auth:fields.password')}
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {apiError ? <p className={styles.error}>{apiError}</p> : null}

          <div className={styles.buttonRow}>
            <button className={styles.submit} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('auth:actions.signingIn') : t('auth:link.confirm')}
            </button>
            <button className={styles.ghostButton} type="button" onClick={onCancel}>
              {t('auth:link.cancel')}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
