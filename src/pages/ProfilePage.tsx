import type { ChangeEvent, ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  type DeleteAccountFormData,
  type DisplayNameFormData,
  type PasswordChangeFormData,
  deleteAccountSchema,
  displayNameSchema,
  passwordChangeSchema,
} from '@/features/profile/schemas'
import { Header } from '@/components/Header'
import { signOut } from '@/services/auth-service'
import {
  changePassword,
  deleteAccount,
  updateDisplayName,
} from '@/services/profile-service'
import { useAuthStore } from '@/store/auth-store'
import { useProfileStore } from '@/store/profile-store'

export function ProfilePage(): ReactElement {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['profile'])
  const profile = useProfileStore((state) => state.profile)
  const setProfile = useProfileStore((state) => state.setProfile)
  const preferredLanguage = useProfileStore((state) => state.preferredLanguage)
  const setPreferredLanguage = useProfileStore((state) => state.setPreferredLanguage)
  const clearSession = useAuthStore((state) => state.clearSession)

  const [displayNameStatus, setDisplayNameStatus] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const hasPasswordProvider = profile?.authProviders?.includes('password') ?? true
  const requiresDeletePassword = profile?.authProviders?.includes('password') ?? true
  const hasSocialProvider = profile?.authProviders?.some((provider) => provider !== 'password') ?? false

  const activeLocale = preferredLanguage === 'cs-CZ' ? 'cs-CZ' : 'en'

  const formatDateTime = (value?: string): string => {
    if (!value) {
      return t('profile:fields.notAvailable')
    }

    return new Intl.DateTimeFormat(activeLocale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value))
  }

  const formatProviders = (): string => {
    if (!profile?.authProviders.length) {
      return t('profile:fields.notAvailable')
    }

    return profile.authProviders
      .map((provider) => t(`profile:providers.${provider}`))
      .join(', ')
  }

  const displayNameForm = useForm<DisplayNameFormData>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: {
      displayName: profile?.displayName || '',
    },
  })

  const passwordForm = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  })

  const deleteForm = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      password: '',
    },
  })

  const submitDisplayName = displayNameForm.handleSubmit(async (values) => {
    const updatedProfile = await updateDisplayName(values.displayName)
    setProfile(updatedProfile)
    setDisplayNameStatus(t('profile:messages.saved'))
    window.setTimeout(() => setDisplayNameStatus(''), 4000)
  })

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    setPasswordStatus('')
    try {
      const updatedProfile = await changePassword(
        values.currentPassword,
        values.newPassword,
      )
      setProfile(updatedProfile)
      setPasswordStatus(t('profile:messages.passwordSaved'))
      passwordForm.reset()
      window.setTimeout(() => setPasswordStatus(''), 4000)
    } catch {
      passwordForm.setError('currentPassword', {
        type: 'server',
        message: 'messages.passwordError',
      })
    }
  })

  const submitDelete = deleteForm.handleSubmit(async (values) => {
    setDeleteError('')

    if (requiresDeletePassword && !values.password) {
      deleteForm.setError('password', {
        type: 'required',
        message: 'validation.passwordRequired',
      })
      return
    }

    try {
      await deleteAccount(values.password)
      await signOut()
      clearSession()
      navigate('/signin')
    } catch {
      setDeleteError(t('profile:messages.deleteError'))
    }
  })

  const onLanguageChange = async (event: ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const nextLanguage = event.target.value === 'cs-CZ' ? 'cs-CZ' : 'en'
    setPreferredLanguage(nextLanguage)
    await i18n.changeLanguage(nextLanguage)
  }

  return (
    <main className="app-shell">
      <Header />
      <section className="profile-grid">
        <article className="panel">
          <h1>{t('profile:title')}</h1>
          <p>
            <strong>{t('profile:fields.email')}:</strong>{' '}
            {profile?.email || t('profile:fields.notAvailable')}
          </p>
          <p>
            <strong>{t('profile:fields.displayName')}:</strong>{' '}
            {profile?.displayName || profile?.email || t('profile:fields.notAvailable')}
          </p>
          <p>
            <strong>{t('profile:fields.providers')}:</strong> {formatProviders()}
          </p>
          <p>
            <strong>{t('profile:fields.createdAt')}:</strong> {formatDateTime(profile?.createdAt)}
          </p>
          <p>
            <strong>{t('profile:fields.updatedAt')}:</strong> {formatDateTime(profile?.updatedAt)}
          </p>
        </article>

        <article className="panel">
          <h2>{t('profile:sections.preferences')}</h2>
          <div className="inline-field">
            <label htmlFor="language">{t('profile:fields.language')}</label>
            <select
              id="language"
              value={preferredLanguage}
              onChange={(event) => void onLanguageChange(event)}
            >
              <option value="en">{t('profile:languages.en')}</option>
              <option value="cs-CZ">{t('profile:languages.cs')}</option>
            </select>
          </div>
        </article>

        <article className="panel">
          <h2>{t('profile:sections.displayName')}</h2>
          <form className="form" onSubmit={(event) => void submitDisplayName(event)}>
            <label htmlFor="displayName">{t('profile:fields.displayName')}</label>
            <input id="displayName" type="text" {...displayNameForm.register('displayName')} />
            <button type="submit">{t('profile:actions.saveDisplayName')}</button>
            {displayNameStatus && <p>{displayNameStatus}</p>}
          </form>
        </article>

        {hasPasswordProvider ? (
          <article className="panel">
            <h2>{t('profile:sections.password')}</h2>
            <form className="form" onSubmit={(event) => void submitPassword(event)}>
              <label htmlFor="currentPassword">{t('profile:fields.currentPassword')}</label>
              <input id="currentPassword" type="password" {...passwordForm.register('currentPassword')} />
              {passwordForm.formState.errors.currentPassword?.message ? (
                <p className="error">
                  {t(`profile:${String(passwordForm.formState.errors.currentPassword.message)}`)}
                </p>
              ) : null}
              <label htmlFor="newPassword">{t('profile:fields.newPassword')}</label>
              <input id="newPassword" type="password" {...passwordForm.register('newPassword')} />
              {passwordForm.formState.errors.newPassword?.message ? (
                <p className="error">
                  {t(`profile:${String(passwordForm.formState.errors.newPassword.message)}`)}
                </p>
              ) : null}
              <button type="submit">{t('profile:actions.savePassword')}</button>
              {passwordStatus && <p>{passwordStatus}</p>}
            </form>
          </article>
        ) : null}

        <article className="panel panel--delete-action">
          {!showDeleteForm ? (
            <button
              className="button-danger"
              type="button"
              onClick={() => setShowDeleteForm(true)}
            >
              {t('profile:actions.startDelete')}
            </button>
          ) : (
            <form className="form" onSubmit={(event) => void submitDelete(event)}>
              {requiresDeletePassword ? (
                <>
                  <p>
                    {hasSocialProvider
                      ? t('profile:messages.deletePasswordRequiredMixed')
                      : t('profile:messages.deletePasswordRequired')}
                  </p>
                  <label htmlFor="deletePassword">{t('profile:fields.password')}</label>
                  <input id="deletePassword" type="password" {...deleteForm.register('password')} />
                  {deleteForm.formState.errors.password?.message ? (
                    <p className="error">
                      {t(`profile:${String(deleteForm.formState.errors.password.message)}`)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p>{t('profile:messages.deleteNoPassword')}</p>
              )}
              <div className="button-row">
                <button className="button-danger" type="submit">
                  {t('profile:actions.confirmDelete')}
                </button>
                <button type="button" onClick={() => setShowDeleteForm(false)}>
                  {t('profile:actions.cancelDelete')}
                </button>
              </div>
              {deleteError && <p className="error">{deleteError}</p>}
            </form>
          )}
        </article>
      </section>
    </main>
  )
}
