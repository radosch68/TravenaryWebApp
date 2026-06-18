import type { FormEvent, ReactElement } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { acquireAppleIdToken } from '@/features/auth/apple-auth'
import { acquireGithubAuthCode } from '@/features/auth/github-auth'
import { GithubSignInButton } from '@/features/auth/GithubSignInButton'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { resolveLandingPath } from '@/features/auth/resolve-landing-path'
import { completeSocialAuth, handleSocialAuth } from '@/features/auth/social-auth-handlers'
import { signUp } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

import styles from './AuthPage.module.css'

function getApiErrorDetail(error: ApiError): string | null {
  const firstDetail = error.details?.[0]
  const detailMessage = firstDetail?.message?.trim()
  const detailField = firstDetail?.field?.trim()
  if (detailMessage) {
    return detailField ? `${detailField}: ${detailMessage}` : detailMessage
  }

  const message = error.message?.trim()
  if (!message || message === 'Request failed' || message === 'Invalid request payload') {
    return null
  }

  return message
}

export function SignUpPage(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'errors'])
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const socialAuthEnabled = import.meta.env.VITE_ENABLE_SOCIAL_AUTH === 'true'
  const googleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const appleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID)
  const githubEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID)

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    try {
      const tokens = await signUp({
        email,
        password,
        displayName: displayName.trim() || undefined,
      })
      const profile = await bootstrapAuthenticatedSession(tokens)
      navigate(profile ? await resolveLandingPath(profile) : '/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setApiError(t('auth:errors.emailTaken'))
      } else if (error instanceof ApiError) {
        const detail = getApiErrorDetail(error)
        setApiError(detail ? `${t('errors:server')} (${detail})` : t('errors:server'))
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
        <h1 className={styles.title}>{t('auth:signUp.title')}</h1>
        <p className={styles.subtitle}>{t('auth:signUp.subtitle')}</p>

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

        <p className={styles.authDivider}>{t('auth:signUp.useEmail')}</p>

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
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="displayName">
              {t('auth:fields.displayName')}
            </label>
            <input
              id="displayName"
              className={styles.input}
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          {apiError ? <p className={styles.error}>{apiError}</p> : null}

          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('auth:actions.signingUp') : t('auth:actions.signUp')}
          </button>
        </form>

        <p className={styles.footer}>
          {t('auth:signUp.hasAccount')}{' '}
          <Link className={styles.link} to="/signin">
            {t('auth:actions.signIn')}
          </Link>
        </p>
      </section>
    </main>
  )
}
