import type { ChangeEvent, ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
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
import { Breadcrumb } from '@/components/Breadcrumb'
import { signOut } from '@/services/auth-service'
import { ApiError } from '@/services/contracts'
import {
  changePassword,
  deleteAccount,
  updateDisplayName,
  updatePreferredLanguage,
} from '@/services/profile-service'
import { useAuthStore } from '@/store/auth-store'
import { useProfileStore } from '@/store/profile-store'

export function ProfilePage(): ReactElement {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['profile', 'common'])
  const profile = useProfileStore((state) => state.profile)
  const setProfile = useProfileStore((state) => state.setProfile)
  const activeLanguage = useProfileStore((state) => state.activeLanguage)
  const applyAuthenticatedProfile = useProfileStore((state) => state.applyAuthenticatedProfile)
  const clearSession = useAuthStore((state) => state.clearSession)

  const [displayNameStatus, setDisplayNameStatus] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const hasPasswordProvider = profile?.authProviders?.includes('password') ?? true
  const requiresDeletePassword = profile?.authProviders?.includes('password') ?? true
  const hasSocialProvider = profile?.authProviders?.some((provider) => provider !== 'password') ?? false
  const canSetInitialPassword = !hasPasswordProvider && hasSocialProvider

  const activeLocale = activeLanguage === 'cs-CZ' ? 'cs-CZ' : 'en'
  const profilePreferredLanguage = profile?.preferredLanguage ?? activeLanguage

  const resolveProfileMessage = (message: string): string => {
    const translated = t(message, { ns: 'profile' })
    return translated === message ? t(`profile:${message}`) : translated
  }

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

  useEffect(() => {
    if (!displayNameForm.formState.isDirty) {
      displayNameForm.reset({ displayName: profile?.displayName || '' })
    }
  }, [displayNameForm, profile?.displayName])

  const passwordForm = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const deleteForm = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      password: '',
    },
  })

  const submitDisplayName = displayNameForm.handleSubmit(async (values) => {
    try {
      const updatedProfile = await updateDisplayName(values.displayName)
      setProfile(updatedProfile)
      setDisplayNameStatus(t('profile:messages.saved'))
      window.setTimeout(() => setDisplayNameStatus(''), 4000)
    } catch {
      setDisplayNameStatus(t('profile:messages.displayNameSaveError'))
    }
  })

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    setPasswordStatus('')

    if (hasPasswordProvider && !values.currentPassword) {
      passwordForm.setError('currentPassword', {
        type: 'required',
        message: 'validation.passwordRequired',
      })
      return
    }

    const settingInitialPassword = !hasPasswordProvider

    try {
      const updatedProfile = await changePassword(
        values.currentPassword,
        values.newPassword,
      )
      setProfile(updatedProfile)
      setPasswordStatus(t(settingInitialPassword ? 'profile:messages.passwordSet' : 'profile:messages.passwordSaved'))
      passwordForm.reset()
      window.setTimeout(() => setPasswordStatus(''), 4000)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        passwordForm.setError('currentPassword', {
          type: 'server',
          message: 'messages.passwordError',
        })
        return
      }

      passwordForm.setError('newPassword', {
        type: 'server',
        message: 'messages.passwordSetError',
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
    const updatedProfile = await updatePreferredLanguage(nextLanguage)
    applyAuthenticatedProfile(updatedProfile)
    await i18n.changeLanguage(updatedProfile.preferredLanguage)
  }

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb items={[{ icon: 'home', to: '/', ariaLabel: t('common:navigation.dashboard') }, { label: profile?.displayName || profile?.email || t('profile:title') }]} />
      <section className="profile-grid">
        <article className="panel">
          <div className="profile-panel__header">
            <h1>{t('profile:title')}</h1>
            {profile?.avatarUrl ? (
              <img
                className="profile-panel__avatar"
                src={profile.avatarUrl}
                alt={t('common:avatarAlt')}
                title={t('profile:fields.avatarLabel')}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
          </div>
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
              value={profilePreferredLanguage}
              onChange={(event) => void onLanguageChange(event)}
            >
              <option value="en">{t('common:languageSelector.optionEnglish')}</option>
              <option value="cs-CZ">{t('common:languageSelector.optionCzech')}</option>
            </select>
          </div>
        </article>

        <article className="panel">
          <h2>{t('profile:sections.displayName')}</h2>
          <form className="form" onSubmit={(event) => void submitDisplayName(event)}>
            <label htmlFor="displayName">{t('profile:fields.displayName')}</label>
            <input
              id="displayName"
              type="text"
              disabled={displayNameForm.formState.isSubmitting}
              {...displayNameForm.register('displayName')}
            />
            <button type="submit" disabled={displayNameForm.formState.isSubmitting}>
              {t('profile:actions.saveDisplayName')}
            </button>
            {displayNameStatus && <p>{displayNameStatus}</p>}
          </form>
        </article>

        <article className="panel">
          <h2>{t('profile:sections.password')}</h2>
          <form className="form" onSubmit={(event) => void submitPassword(event)}>
            {canSetInitialPassword ? (
              <p className="text-muted">{t('profile:messages.passwordOptionalForSocial')}</p>
            ) : null}
            {hasPasswordProvider ? (
              <>
                <label htmlFor="currentPassword">{t('profile:fields.currentPassword')}</label>
                <input
                  id="currentPassword"
                  type="password"
                  disabled={passwordForm.formState.isSubmitting}
                  {...passwordForm.register('currentPassword')}
                />
                {passwordForm.formState.errors.currentPassword?.message ? (
                  <p className="error">
                    {resolveProfileMessage(String(passwordForm.formState.errors.currentPassword.message))}
                  </p>
                ) : null}
              </>
            ) : null}
            <label htmlFor="newPassword">{t('profile:fields.newPassword')}</label>
            <input
              id="newPassword"
              type="password"
              disabled={passwordForm.formState.isSubmitting}
              {...passwordForm.register('newPassword')}
            />
            {passwordForm.formState.errors.newPassword?.message ? (
              <p className="error">
                {resolveProfileMessage(String(passwordForm.formState.errors.newPassword.message))}
              </p>
            ) : null}
            <label htmlFor="confirmNewPassword">{t('profile:fields.confirmNewPassword')}</label>
            <input
              id="confirmNewPassword"
              type="password"
              disabled={passwordForm.formState.isSubmitting}
              {...passwordForm.register('confirmNewPassword')}
            />
            {passwordForm.formState.errors.confirmNewPassword?.message ? (
              <p className="error">
                {resolveProfileMessage(String(passwordForm.formState.errors.confirmNewPassword.message))}
              </p>
            ) : null}
            <button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {t(hasPasswordProvider ? 'profile:actions.savePassword' : 'profile:actions.setPassword')}
            </button>
            {passwordStatus && <p>{passwordStatus}</p>}
          </form>
        </article>

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
                  <input
                    id="deletePassword"
                    type="password"
                    disabled={deleteForm.formState.isSubmitting}
                    {...deleteForm.register('password')}
                  />
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
                <button
                  className="button-danger"
                  type="submit"
                  disabled={deleteForm.formState.isSubmitting}
                >
                  {t('profile:actions.confirmDelete')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteForm(false)}
                  disabled={deleteForm.formState.isSubmitting}
                >
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
