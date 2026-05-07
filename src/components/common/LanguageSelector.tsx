import { Check } from 'lucide-react'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import styles from './LanguageSelector.module.css'

const LANGUAGE_KEY = 'preferredLanguage'

type SupportedLanguage = 'en' | 'cs-CZ'

interface LanguageSelectorProps {
  className?: string
}

export function LanguageSelector({ className }: LanguageSelectorProps): ReactElement {
  const { i18n, t } = useTranslation(['common'])
  const currentLanguage: SupportedLanguage = i18n.language === 'cs-CZ' ? 'cs-CZ' : 'en'
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const desktopLabel =
    currentLanguage === 'cs-CZ'
      ? t('common:languageSelector.optionCzech')
      : t('common:languageSelector.optionEnglish')
  const mobileLabel =
    currentLanguage === 'cs-CZ'
      ? t('common:languageSelector.shortCzech')
      : t('common:languageSelector.shortEnglish')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onDocumentPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', onDocumentPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  async function onChange(nextLanguage: SupportedLanguage): Promise<void> {
    localStorage.setItem(LANGUAGE_KEY, nextLanguage)
    await i18n.changeLanguage(nextLanguage)
    setIsOpen(false)
  }

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('common:languageSelector.ariaLabel')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={styles.trigger}
        onClick={() => {
          setIsOpen((prev) => !prev)
        }}
      >
        <span className={styles.labelDesktop}>{desktopLabel}</span>
        <span className={styles.labelMobile}>{mobileLabel}</span>
      </Button>

      {isOpen ? (
        <div className={styles.menu} role="menu" aria-label={t('common:languageSelector.ariaLabel')}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentLanguage === 'en'}
            className={styles.item}
            onClick={() => {
              void onChange('en')
            }}
          >
            <span>{t('common:languageSelector.optionEnglish')}</span>
            {currentLanguage === 'en' ? <Check aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentLanguage === 'cs-CZ'}
            className={styles.item}
            onClick={() => {
              void onChange('cs-CZ')
            }}
          >
            <span>{t('common:languageSelector.optionCzech')}</span>
            {currentLanguage === 'cs-CZ' ? <Check aria-hidden="true" /> : null}
          </button>
        </div>
      ) : null}
    </div>
  )
}
