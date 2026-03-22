import type { ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { type SignInFormData, signInSchema } from '@/features/auth/schemas'
import { linkSocialProvider, signIn } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import { useAuthStore } from '@/store/auth-store'

export function LinkProviderPage(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const bootstrapAuthenticatedSession = useAuthStore(
    (state) => state.bootstrapAuthenticatedSession,
  )
  const collision = useAuthStore((state) => state.identityCollision)
  const clearIdentityCollision = useAuthStore((state) => state.clearIdentityCollision)
  const [apiError, setApiError] = useState('')

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: collision?.email ?? '',
      password: '',
    },
  })

  useEffect(() => {
    form.reset({
      email: collision?.email ?? '',
      password: '',
    })
  }, [collision?.email, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!collision) {
      navigate('/signin')
      return
    }

    setApiError('')

    try {
      const tokens = await signIn(values)
      await bootstrapAuthenticatedSession(tokens)
      await linkSocialProvider(collision.provider, collision.idToken)
      clearIdentityCollision()
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setApiError(t('errors.invalidCredentials'))
        return
      }

      setApiError(t('errors.linkFailed'))
    }
  })

  const onCancel = (): void => {
    clearIdentityCollision()
    navigate('/signin')
  }

  const providerLabel = collision?.provider === 'apple' ? 'Apple' : 'Google'

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>{t('link.title')}</h1>
        <p>{t('link.subtitle', { provider: providerLabel })}</p>
        <p>
          {collision?.email
            ? t('link.emailPrefilled', { email: collision.email, provider: providerLabel })
            : t('link.emailUnknown', { provider: providerLabel })}
        </p>
        <form className="form" onSubmit={(event) => void onSubmit(event)}>
          <label htmlFor="email">{t('fields.email')}</label>
          <input id="email" type="email" readOnly={Boolean(collision?.email)} {...form.register('email')} />

          <label htmlFor="password">{t('fields.password')}</label>
          <input id="password" type="password" {...form.register('password')} />

          {apiError && <p className="error">{apiError}</p>}

          <div className="button-row">
            <button type="submit" disabled={form.formState.isSubmitting}>
              {t('link.confirm')}
            </button>
            <button type="button" onClick={onCancel}>
              {t('link.cancel')}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
