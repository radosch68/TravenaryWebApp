import type { ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandLanguageHeader } from '@/components/BrandLanguageHeader'
import { acquireAppleIdToken } from '@/features/auth/apple-auth'
import { GithubSignInButton } from '@/features/auth/GithubSignInButton'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { completeSocialAuth, handleSocialAuth } from '@/features/auth/social-auth-handlers'
import { type SignInFormData, signInSchema } from '@/features/auth/schemas'
import { acquireGithubAuthCode } from '../features/auth/github-auth'
import { apiRequest } from '@/services/api-client'
import { signIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

const HEALTH_CHECK_INTERVAL_MS = 1_000
const HEALTH_CHECK_TIMEOUT_MS = 2_500
const HEALTH_READY_CACHE_KEY = 'backendHealthReadyAt'
const HEALTH_READY_CACHE_TTL_MS = 90_000

type SignInLocationState = {
  oneTimeMessageKey?: string
}

function hasRecentHealthyBackend(): boolean {
  const rawValue = window.sessionStorage.getItem(HEALTH_READY_CACHE_KEY)
  if (!rawValue) {
    return false
  }

  const lastHealthyAt = Number(rawValue)
  if (!Number.isFinite(lastHealthyAt)) {
    return false
  }

  return Date.now() - lastHealthyAt <= HEALTH_READY_CACHE_TTL_MS
}

export function SignInPage(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'errors'])
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const [apiError, setApiError] = useState('')
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false)
  const [isBackendReady, setIsBackendReady] = useState(() => hasRecentHealthyBackend())
  const [isBackendChecking, setIsBackendChecking] = useState(() => !hasRecentHealthyBackend())
  const healthProbeInFlight = useRef(false)

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const socialAuthEnabled = import.meta.env.VITE_ENABLE_SOCIAL_AUTH === 'true'
  const googleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const appleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID)
  const githubEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID)
  const authActionsDisabled = !isBackendReady
  const controlsDisabled = authActionsDisabled || isAuthTransitioning

  useEffect(() => {
    const state = location.state as SignInLocationState | null
    const oneTimeMessageKey = state?.oneTimeMessageKey
    if (!oneTimeMessageKey) {
      return
    }

    setApiError(t(oneTimeMessageKey))
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, t])

  useEffect(() => {
    let disposed = false

    const probeHealth = async (): Promise<void> => {
      if (disposed || healthProbeInFlight.current || isBackendReady) {
        return
      }

      healthProbeInFlight.current = true
      try {
        await apiRequest<{ status?: string }>('/health', {
          timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
        })

        if (!disposed) {
          setIsBackendReady(true)
          window.sessionStorage.setItem(HEALTH_READY_CACHE_KEY, String(Date.now()))
        }
      } catch {
        if (!disposed) {
          setIsBackendReady((previous) => previous)
        }
      } finally {
        healthProbeInFlight.current = false
        if (!disposed) {
          setIsBackendChecking(false)
        }
      }
    }

    void probeHealth()

    const intervalId = window.setInterval(() => {
      void probeHealth()
    }, HEALTH_CHECK_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [isBackendReady])

  const onSubmit = form.handleSubmit(async (values) => {
    if (authActionsDisabled) {
      setApiError(t('auth:social.backendStarting'))
      return
    }

    setIsAuthTransitioning(true)
    setApiError('')
    try {
      const tokens = await signIn(values)
      await bootstrapAuthenticatedSession(tokens)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setApiError(t('auth:errors.invalidCredentials'))
      } else {
        setApiError(t('errors:server'))
      }
    } finally {
      setIsAuthTransitioning(false)
    }
  })

  const onApple = async (): Promise<void> => {
    if (authActionsDisabled) {
      setApiError(t('auth:social.backendStarting'))
      return
    }

    setIsAuthTransitioning(true)
    await handleSocialAuth('apple', acquireAppleIdToken, navigate, setApiError)
    setIsAuthTransitioning(false)
  }

  const onGoogleIdToken = async (idToken: string): Promise<void> => {
    if (authActionsDisabled) {
      setApiError(t('auth:social.backendStarting'))
      return
    }

    setIsAuthTransitioning(true)
    setApiError('')
    await completeSocialAuth('google', idToken, navigate, setApiError)
    setIsAuthTransitioning(false)
  }

  const onGithub = async (): Promise<void> => {
    if (authActionsDisabled) {
      setApiError(t('auth:social.backendStarting'))
      return
    }

    setIsAuthTransitioning(true)
    await handleSocialAuth('github', acquireGithubAuthCode, navigate, setApiError)
    setIsAuthTransitioning(false)
  }

  return (
    <main className="auth-shell">
      <BrandLanguageHeader />
      <section className="auth-card">
        <h1>{t('auth:signIn.title')}</h1>
        <p>{t('auth:signIn.subtitle')}</p>

        {googleEnabled || appleEnabled || githubEnabled ? (
          <div className="social-row">
            {googleEnabled ? (
              controlsDisabled ? (
                <button className="social-provider-btn" disabled type="button">
                  {t('auth:actions.continueGoogle')}
                </button>
              ) : (
                <GoogleSignInButton onIdToken={onGoogleIdToken} />
              )
            ) : null}
            {githubEnabled ? (
              <GithubSignInButton
                disabled={controlsDisabled}
                onClick={onGithub}
                label={t('auth:actions.continueGithub')}
              />
            ) : null}
            {appleEnabled ? (
              <button type="button" disabled={controlsDisabled} onClick={() => void onApple()}>
                {t('auth:actions.continueApple')}
              </button>
            ) : null}
          </div>
        ) : (
          <p>{t('auth:social.disabled')}</p>
        )}

        {!isBackendReady || isBackendChecking ? (
          <div className="backend-waking-alert" role="status" aria-live="polite">
            <span className="backend-waking-alert__spinner" aria-hidden="true" />
            <span>{t('auth:social.backendStartingLine1')}</span>
            <span>{t('auth:social.backendStartingLine2')}</span>
          </div>
        ) : null}

        {isAuthTransitioning ? (
          <div className="backend-waking-alert backend-waking-alert--success" role="status" aria-live="polite">
            <span className="backend-waking-alert__spinner" aria-hidden="true" />
            <span>{t('auth:social.signingIn')}</span>
          </div>
        ) : null}

        <p className="auth-divider">{t('auth:signIn.useEmail')}</p>

        <form className="form" onSubmit={(event) => void onSubmit(event)}>
          <label htmlFor="email">{t('auth:fields.email')}</label>
          <input id="email" type="email" {...form.register('email')} />
          {form.formState.errors.email?.message && (
            <p className="error">{t(`auth:${form.formState.errors.email.message}`)}</p>
          )}

          <label htmlFor="password">{t('auth:fields.password')}</label>
          <input id="password" type="password" {...form.register('password')} />
          {form.formState.errors.password?.message && (
            <p className="error">{t(`auth:${form.formState.errors.password.message}`)}</p>
          )}

          {apiError && <p className="error">{apiError}</p>}

          <button type="submit" disabled={form.formState.isSubmitting || controlsDisabled}>
            {form.formState.isSubmitting
              ? t('auth:actions.signingIn')
              : t('auth:actions.signIn')}
          </button>
        </form>

        <p>
          {t('auth:signIn.noAccount')}{' '}
          {!controlsDisabled ? (
            <Link to="/signup">{t('auth:actions.createAccount')}</Link>
          ) : (
            <span aria-disabled="true" className="auth-link-disabled">
              {t('auth:actions.createAccount')}
            </span>
          )}
        </p>
      </section>
    </main>
  )
}
