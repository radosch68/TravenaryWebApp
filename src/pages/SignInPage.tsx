import type { FormEvent, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { acquireAppleIdToken } from '@/features/auth/apple-auth'
import { acquireGithubAuthCode } from '@/features/auth/github-auth'
import { GithubSignInButton } from '@/features/auth/GithubSignInButton'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { completeSocialAuth, handleSocialAuth } from '@/features/auth/social-auth-handlers'
import { signIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

import styles from './AuthPage.module.css'

type SignInLocationState = {
  oneTimeMessageKey?: string
}

export function SignInPage(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'errors'])
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const state = location.state as SignInLocationState | null
  const oneTimeMessage = state?.oneTimeMessageKey ? t(state.oneTimeMessageKey) : ''

  const socialAuthEnabled = import.meta.env.VITE_ENABLE_SOCIAL_AUTH === 'true'
  const googleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const appleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID)
  const githubEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID)

  useEffect(() => {
    const oneTimeMessageKey = state?.oneTimeMessageKey
    if (!oneTimeMessageKey) {
      return
    }

    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, state?.oneTimeMessageKey])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setApiError('')

    try {
      const tokens = await signIn({ email, password })
      await bootstrapAuthenticatedSession(tokens)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setApiError(t('auth:errors.invalidCredentials'))
      } else {
        setApiError(t('errors:server'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onApple(): Promise<void> {
    await handleSocialAuth('apple', acquireAppleIdToken, navigate, setApiError)
  }

  async function onGoogleIdToken(idToken: string): Promise<void> {
    await completeSocialAuth('google', idToken, navigate, setApiError)
  }

  async function onGithub(): Promise<void> {
    await handleSocialAuth('github', acquireGithubAuthCode, navigate, setApiError)
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <p className={styles.brand}>Travenary</p>
        <h1 className={styles.title}>{t('auth:signIn.title')}</h1>
        <p className={styles.subtitle}>{t('auth:signIn.subtitle')}</p>

        {googleEnabled || appleEnabled || githubEnabled ? (
          <div className={styles.socialRow}>
            {googleEnabled ? <GoogleSignInButton onIdToken={onGoogleIdToken} /> : null}
            {githubEnabled ? (
              <GithubSignInButton
                disabled={isSubmitting}
                onClick={onGithub}
                label={t('auth:actions.continueGithub')}
              />
            ) : null}
            {appleEnabled ? (
              <button
                className={styles.socialProviderBtn}
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  void onApple()
                }}
              >
                {t('auth:actions.continueApple')}
              </button>
            ) : null}
          </div>
        ) : (
          <p className={styles.subtitle}>{t('auth:social.disabled')}</p>
        )}

        <p className={styles.authDivider}>{t('auth:signIn.useEmail')}</p>

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
              required
              value={email}
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

          {apiError || oneTimeMessage ? (
            <p className={styles.error}>{apiError || oneTimeMessage}</p>
          ) : null}

          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('auth:actions.signingIn') : t('auth:actions.signIn')}
          </button>
        </form>

        <p className={styles.footer}>
          {t('auth:signIn.noAccount')}{' '}
          <Link className={styles.link} to="/signup">
            {t('auth:actions.createAccount')}
          </Link>
        </p>
      </section>
    </main>
  )
}
