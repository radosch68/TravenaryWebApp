import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { ApiError, type UserProfile } from '@/services/contracts'
import {
  changePassword,
  deleteAccount,
  getMe,
  updateDisplayName,
  updatePreferredLanguage,
} from '@/services/profile-service'
import { useAuthStore } from '@/store/auth-store'
import { useProfileStore } from '@/store/profile-store'

import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['profile', 'common', 'errors'])
  const clearSession = useAuthStore((state) => state.clearSession)
  const setProfileStore = useProfileStore((state) => state.setProfile)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [displayNameValue, setDisplayNameValue] = useState('')
  const [displayNameStatus, setDisplayNameStatus] = useState('')
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false)

  const [isSavingLanguage, setIsSavingLanguage] = useState(false)

  const [currentPasswordValue, setCurrentPasswordValue] = useState('')
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [confirmNewPasswordValue, setConfirmNewPasswordValue] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deletePasswordValue, setDeletePasswordValue] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProfile(): Promise<void> {
      setIsLoading(true)
      setLoadError('')
      try {
        const loadedProfile = await getMe()
        if (!isMounted) {
          return
        }

        setProfile(loadedProfile)
        setDisplayNameValue(loadedProfile.displayName || '')
        setProfileStore(loadedProfile.displayName ?? null, loadedProfile.email)
      } catch {
        if (!isMounted) {
          return
        }

        setLoadError(t('profile:messages.loadError'))
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [t])

  const hasPasswordProvider = profile?.authProviders?.includes('password') ?? true
  const hasSocialProvider = profile?.authProviders?.some((provider) => provider !== 'password') ?? false
  const requiresDeletePassword = hasPasswordProvider
  const canSetInitialPassword = !hasPasswordProvider && hasSocialProvider

  const activeLocale = i18n.language === 'cs-CZ' ? 'cs-CZ' : 'en'

  const formattedProviders = useMemo(() => {
    if (!profile?.authProviders.length) {
      return t('profile:fields.notAvailable')
    }

    return profile.authProviders.map((provider) => t(`profile:providers.${provider}`)).join(', ')
  }, [profile?.authProviders, t])

  function formatDateTime(value?: string): string {
    if (!value) {
      return t('profile:fields.notAvailable')
    }

    return new Intl.DateTimeFormat(activeLocale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value))
  }

  async function onDisplayNameSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!profile || isSavingDisplayName) {
      return
    }

    const trimmedDisplayName = displayNameValue.trim()
    if (!trimmedDisplayName) {
      setDisplayNameStatus(t('profile:validation.displayNameRequired'))
      return
    }

    if (trimmedDisplayName.length > 80) {
      setDisplayNameStatus(t('profile:validation.displayNameMax'))
      return
    }

    setIsSavingDisplayName(true)
    setDisplayNameStatus('')
    try {
      const updatedProfile = await updateDisplayName(trimmedDisplayName)
      setProfile(updatedProfile)
      setDisplayNameValue(updatedProfile.displayName || '')
      setProfileStore(updatedProfile.displayName ?? null, updatedProfile.email)
      setDisplayNameStatus(t('profile:messages.saved'))
    } catch {
      setDisplayNameStatus(t('profile:messages.displayNameSaveError'))
    } finally {
      setIsSavingDisplayName(false)
    }
  }

  async function onLanguageChange(event: ChangeEvent<HTMLSelectElement>): Promise<void> {
    if (!profile || isSavingLanguage) {
      return
    }

    const nextLanguage = event.target.value === 'cs-CZ' ? 'cs-CZ' : 'en'
    setIsSavingLanguage(true)
    try {
      const updatedProfile = await updatePreferredLanguage(nextLanguage)
      setProfile(updatedProfile)
      localStorage.setItem('preferredLanguage', updatedProfile.preferredLanguage)
      await i18n.changeLanguage(updatedProfile.preferredLanguage)
    } catch {
      setLoadError(t('errors:server'))
    } finally {
      setIsSavingLanguage(false)
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!profile || isSavingPassword) {
      return
    }

    setPasswordStatus('')

    if (hasPasswordProvider && !currentPasswordValue.trim()) {
      setPasswordStatus(t('profile:validation.passwordRequired'))
      return
    }

    if (newPasswordValue.length < 8) {
      setPasswordStatus(t('profile:validation.passwordMin'))
      return
    }

    if (newPasswordValue !== confirmNewPasswordValue) {
      setPasswordStatus(t('profile:validation.passwordMismatch'))
      return
    }

    setIsSavingPassword(true)
    try {
      const updatedProfile = await changePassword(
        hasPasswordProvider ? currentPasswordValue : undefined,
        newPasswordValue,
      )
      setProfile(updatedProfile)
      setCurrentPasswordValue('')
      setNewPasswordValue('')
      setConfirmNewPasswordValue('')
      setPasswordStatus(t(hasPasswordProvider ? 'profile:messages.passwordSaved' : 'profile:messages.passwordSet'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setPasswordStatus(t('profile:messages.passwordError'))
        return
      }

      setPasswordStatus(t('profile:messages.passwordSetError'))
    } finally {
      setIsSavingPassword(false)
    }
  }

  async function onDeleteSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!profile || isDeleting) {
      return
    }

    setDeleteError('')

    if (requiresDeletePassword && !deletePasswordValue.trim()) {
      setDeleteError(t('profile:validation.passwordRequired'))
      return
    }

    setIsDeleting(true)
    try {
      await deleteAccount(requiresDeletePassword ? deletePasswordValue : undefined)
      clearSession()
      navigate('/signin')
    } catch {
      setDeleteError(t('profile:messages.deleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <section className={styles.panel}>
          <p className={styles.loading}>{t('common:loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell>
        <section className={styles.panel}>
          <p className={styles.error}>{loadError || t('errors:unknown')}</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.heroCard}>
          <p className={styles.kicker}>{t('common:navigation.profile')}</p>
          <h1 className={styles.title}>{profile.displayName || profile.email || t('common:profile.title')}</h1>
          <p className={styles.subtitle}>{t('common:profile.subtitle')}</p>
          {loadError ? <p className={styles.error}>{loadError}</p> : null}
        </section>

        <section className={styles.grid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.sectionTitle}>{t('profile:sections.overview')}</h2>
              {profile.avatarUrl ? (
                <img
                  className={styles.avatar}
                  src={profile.avatarUrl}
                  alt={t('profile:fields.avatarLabel')}
                  title={t('profile:fields.avatarLabel')}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
            </div>
            <dl className={styles.definitionList}>
              <div className={styles.definitionRow}>
                <dt>{t('profile:fields.email')}</dt>
                <dd>{profile.email || t('profile:fields.notAvailable')}</dd>
              </div>
              <div className={styles.definitionRow}>
                <dt>{t('profile:fields.displayName')}</dt>
                <dd>{profile.displayName || profile.email || t('profile:fields.notAvailable')}</dd>
              </div>
              <div className={styles.definitionRow}>
                <dt>{t('profile:fields.providers')}</dt>
                <dd>{formattedProviders}</dd>
              </div>
              <div className={styles.definitionRow}>
                <dt>{t('profile:fields.createdAt')}</dt>
                <dd>{formatDateTime(profile.createdAt)}</dd>
              </div>
              <div className={styles.definitionRow}>
                <dt>{t('profile:fields.updatedAt')}</dt>
                <dd>{formatDateTime(profile.updatedAt)}</dd>
              </div>
            </dl>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.sectionTitle}>{t('profile:sections.preferences')}</h2>
            <form className={styles.form} onSubmit={(event) => void onDisplayNameSubmit(event)}>
              <div className={styles.field}>
                <label htmlFor="displayName">{t('profile:fields.displayName')}</label>
                <input
                  id="displayName"
                  className={styles.input}
                  type="text"
                  autoComplete="name"
                  value={displayNameValue}
                  onChange={(event) => setDisplayNameValue(event.target.value)}
                  disabled={isSavingDisplayName}
                  maxLength={80}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="preferredLanguage">{t('profile:fields.language')}</label>
                <select
                  id="preferredLanguage"
                  className={styles.select}
                  value={profile.preferredLanguage}
                  onChange={(event) => {
                    void onLanguageChange(event)
                  }}
                  disabled={isSavingLanguage}
                >
                  <option value="en">{t('common:languageSelector.optionEnglish')}</option>
                  <option value="cs-CZ">{t('common:languageSelector.optionCzech')}</option>
                </select>
              </div>
              <button className={styles.primaryButton} type="submit" disabled={isSavingDisplayName}>
                {t('profile:actions.saveDisplayName')}
              </button>
              {displayNameStatus ? (
                <p
                  className={displayNameStatus === t('profile:messages.saved') ? styles.success : styles.error}
                >
                  {displayNameStatus}
                </p>
              ) : null}
            </form>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.sectionTitle}>{t('profile:sections.password')}</h2>
            <form className={styles.form} onSubmit={(event) => void onPasswordSubmit(event)}>
              {canSetInitialPassword ? (
                <p className={styles.mutedText}>{t('profile:messages.passwordOptionalForSocial')}</p>
              ) : null}

              {hasPasswordProvider ? (
                <div className={styles.field}>
                  <label htmlFor="currentPassword">{t('profile:fields.currentPassword')}</label>
                  <input
                    id="currentPassword"
                    className={styles.input}
                    type="password"
                    autoComplete="current-password"
                    value={currentPasswordValue}
                    onChange={(event) => setCurrentPasswordValue(event.target.value)}
                    disabled={isSavingPassword}
                  />
                </div>
              ) : null}

              <div className={styles.field}>
                <label htmlFor="newPassword">{t('profile:fields.newPassword')}</label>
                <input
                  id="newPassword"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordValue}
                  onChange={(event) => setNewPasswordValue(event.target.value)}
                  disabled={isSavingPassword}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="confirmNewPassword">{t('profile:fields.confirmNewPassword')}</label>
                <input
                  id="confirmNewPassword"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPasswordValue}
                  onChange={(event) => setConfirmNewPasswordValue(event.target.value)}
                  disabled={isSavingPassword}
                />
              </div>

              <button className={styles.primaryButton} type="submit" disabled={isSavingPassword}>
                {t(hasPasswordProvider ? 'profile:actions.savePassword' : 'profile:actions.setPassword')}
              </button>

              {passwordStatus ? (
                <p
                  className={
                    passwordStatus === t('profile:messages.passwordSaved') ||
                    passwordStatus === t('profile:messages.passwordSet')
                      ? styles.success
                      : styles.error
                  }
                >
                  {passwordStatus}
                </p>
              ) : null}
            </form>
          </article>

          <article className={styles.panel}>
            {!showDeleteForm ? (
              <button
                className={styles.dangerButton}
                type="button"
                onClick={() => {
                  setShowDeleteForm(true)
                  setDeleteError('')
                }}
              >
                {t('profile:actions.startDelete')}
              </button>
            ) : (
              <form className={styles.form} onSubmit={(event) => void onDeleteSubmit(event)}>
                {requiresDeletePassword ? (
                  <>
                    <p className={styles.mutedText}>
                      {hasSocialProvider
                        ? t('profile:messages.deletePasswordRequiredMixed')
                        : t('profile:messages.deletePasswordRequired')}
                    </p>
                    <div className={styles.field}>
                      <label htmlFor="deletePassword">{t('profile:fields.password')}</label>
                      <input
                        id="deletePassword"
                        className={styles.input}
                        type="password"
                        autoComplete="current-password"
                        value={deletePasswordValue}
                        onChange={(event) => setDeletePasswordValue(event.target.value)}
                        disabled={isDeleting}
                      />
                    </div>
                  </>
                ) : (
                  <p className={styles.mutedText}>{t('profile:messages.deleteNoPassword')}</p>
                )}

                <div className={styles.buttonRow}>
                  <button className={styles.dangerButton} type="submit" disabled={isDeleting}>
                    {t('profile:actions.confirmDelete')}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => {
                      setShowDeleteForm(false)
                      setDeletePasswordValue('')
                      setDeleteError('')
                    }}
                    disabled={isDeleting}
                  >
                    {t('profile:actions.cancelDelete')}
                  </button>
                </div>

                {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
              </form>
            )}
          </article>
        </section>
      </div>
    </AppShell>
  )
}