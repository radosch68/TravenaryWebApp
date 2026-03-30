import type { ReactElement } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SupportedLanguage } from '@/services/contracts'
import { useProfileStore } from '@/store/profile-store'

const SUPPORTED_LANGUAGE_ORDER: SupportedLanguage[] = ['en', 'cs-CZ']

function normalizeSupportedLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'cs-CZ' ? 'cs-CZ' : 'en'
}

function languageToDisplayCode(language: SupportedLanguage): 'EN' | 'CZ' {
  return language === 'cs-CZ' ? 'CZ' : 'EN'
}

interface LanguageSelectorProps {
  className?: string
}

export function LanguageSelector({ className }: LanguageSelectorProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const activeLanguage = useProfileStore((state) => state.activeLanguage)
  const profile = useProfileStore((state) => state.profile)
  const setActiveLanguage = useProfileStore((state) => state.setActiveLanguage)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  const resolvedActiveLanguage = normalizeSupportedLanguage(i18n.language || activeLanguage)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      if (!rootRef.current) {
        return
      }

      const target = event.target as Node | null
      if (target && !rootRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleLanguageChange = useCallback(async (nextLanguageValue: SupportedLanguage): Promise<void> => {
    const nextLanguage = normalizeSupportedLanguage(nextLanguageValue)
    setActiveLanguage(nextLanguage, { persist: !profile })
    await i18n.changeLanguage(nextLanguage)
    setMenuOpen(false)
  }, [i18n, profile, setActiveLanguage])

  return (
    <div ref={rootRef} className={className ?? 'language-selector'}>
      <button
        type="button"
        className="language-selector__trigger"
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        aria-controls={menuOpen ? menuId : undefined}
        aria-label={t('common:languageSelector.ariaLabel')}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span className="language-selector__trigger-code">{languageToDisplayCode(resolvedActiveLanguage)}</span>
      </button>
      {menuOpen ? (
        <div id={menuId} className="language-selector__panel" role="listbox" aria-label={t('common:languageSelector.ariaLabel')}>
          {SUPPORTED_LANGUAGE_ORDER.map((language) => (
            <button
              key={language}
              type="button"
              className={language === resolvedActiveLanguage ? 'language-selector__item language-selector__item--active' : 'language-selector__item'}
              role="option"
              aria-selected={language === resolvedActiveLanguage}
              onClick={() => {
                void handleLanguageChange(language)
              }}
            >
              {language === 'cs-CZ' ? t('common:languageSelector.optionCzech') : t('common:languageSelector.optionEnglish')}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
