import type { ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { acquireAppleIdToken } from '@/features/auth/apple-auth'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { completeSocialAuth, handleSocialAuth } from '@/features/auth/social-auth-handlers'
import { type SignInFormData, signInSchema } from '@/features/auth/schemas'
import { signIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

export function SignInPage(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'errors'])
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const [apiError, setApiError] = useState('')

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const socialAuthEnabled = import.meta.env.VITE_ENABLE_SOCIAL_AUTH === 'true'
  const googleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const appleEnabled = socialAuthEnabled && Boolean(import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID)

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError('')
    try {
      const tokens = await signIn(values)
      await bootstrapAuthenticatedSession(tokens)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setApiError(t('auth:errors.invalidCredentials'))
        return
      }

      setApiError(t('errors:server'))
    }
  })

  const onApple = async (): Promise<void> => {
    await handleSocialAuth('apple', acquireAppleIdToken, navigate, setApiError)
  }

  const onGoogleIdToken = async (idToken: string): Promise<void> => {
    setApiError('')
    await completeSocialAuth('google', idToken, navigate, setApiError)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>{t('auth:signIn.title')}</h1>
        <p>{t('auth:signIn.subtitle')}</p>

        <form className="form" onSubmit={(event) => void onSubmit(event)}>
          <label htmlFor="email">{t('auth:fields.email')}</label>
          <input id="email" type="email" {...form.register('email')} />
          <p>{form.formState.errors.email?.message ? t(`auth:${form.formState.errors.email.message}`) : ''}</p>

          <label htmlFor="password">{t('auth:fields.password')}</label>
          <input id="password" type="password" {...form.register('password')} />
          <p>{form.formState.errors.password?.message ? t(`auth:${form.formState.errors.password.message}`) : ''}</p>

          {apiError && <p className="error">{apiError}</p>}

          <button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t('auth:actions.signingIn')
              : t('auth:actions.signIn')}
          </button>
        </form>

        {googleEnabled || appleEnabled ? (
          <div className="social-row">
            {googleEnabled ? (
              <GoogleSignInButton onIdToken={onGoogleIdToken} />
            ) : null}
            {appleEnabled ? (
              <button type="button" onClick={() => void onApple()}>
                {t('auth:actions.continueApple')}
              </button>
            ) : null}
          </div>
        ) : (
          <p>{t('auth:social.disabled')}</p>
        )}

        <p>
          {t('auth:signIn.noAccount')} <Link to="/signup">{t('auth:actions.createAccount')}</Link>
        </p>
      </section>
    </main>
  )
}
