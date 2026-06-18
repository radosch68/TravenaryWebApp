import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { getMe, markAboutSeen } from '@/services/profile-service'

import styles from './AboutPage.module.css'

const SECTION_KEYS = ['what', 'start', 'ai', 'organize'] as const

export function AboutPage(): ReactElement {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  // Tracks the user's current seenAbout state so we only flip the flag for users
  // who haven't dismissed the intro yet (manual visits from the menu must not
  // touch it). null = still loading / unknown.
  const seenAboutRef = useRef<boolean | null>(null)

  useEffect(() => {
    let isMounted = true

    void getMe()
      .then((profile) => {
        if (isMounted) {
          seenAboutRef.current = profile.onboarding?.seenAbout ?? true
        }
      })
      .catch(() => {
        // Non-fatal: if we cannot read the profile we simply skip the flag flip.
      })

    // Flip on dismiss (navigating away), not on render. Idempotent and
    // fire-and-forget: a failure just means the intro may appear once more.
    return () => {
      isMounted = false
      if (seenAboutRef.current === false) {
        void markAboutSeen().catch(() => {})
      }
    }
  }, [])

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.heroCard}>
          <p className={styles.kicker}>{t('about.kicker')}</p>
          <h1 className={styles.title}>{t('about.title')}</h1>
          <p className={styles.subtitle}>{t('about.subtitle')}</p>
          <p className={styles.intro}>{t('about.intro')}</p>
        </section>

        <section className={styles.grid}>
          {SECTION_KEYS.map((key) => (
            <article key={key} className={styles.panel}>
              <h2 className={styles.sectionTitle}>{t(`about.sections.${key}Title`)}</h2>
              <p className={styles.sectionBody}>{t(`about.sections.${key}Body`)}</p>
            </article>
          ))}
        </section>

        <div className={styles.ctaRow}>
          <button type="button" className={styles.ctaButton} onClick={() => navigate('/')}>
            {t('about.cta')}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
