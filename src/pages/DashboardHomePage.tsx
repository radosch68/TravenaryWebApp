import { ArrowRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { useProfileStore } from '@/store/profile-store'

import styles from './DashboardHomePage.module.css'

export function DashboardHomePage(): ReactElement {
  const { t } = useTranslation('common')
  const displayName = useProfileStore((state) => state.displayName)
  const email = useProfileStore((state) => state.email)
  const backendLastOpenedItinerary = useProfileStore((state) => state.lastOpenedItinerary)
  const name = displayName || email
  const rememberedItinerary = backendLastOpenedItinerary?.itineraryId
    ? {
        id: backendLastOpenedItinerary.itineraryId,
        title: backendLastOpenedItinerary.itineraryTitle ?? null,
      }
    : null
  const openTarget = rememberedItinerary?.id ? `/itineraries/${rememberedItinerary.id}` : '/itineraries'
  const hasResumeTitle = Boolean(rememberedItinerary?.title)

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>{t('dashboardHome.kicker')}</p>
            <h1 className={styles.title}>
              {name ? t('dashboardHome.titleWithName', { name }) : t('dashboardHome.title')}
            </h1>
            <p className={styles.subtitle}>{t('dashboardHome.subtitle')}</p>
          </div>

          <Button
            type="button"
            asChild
            size="sm"
            className={hasResumeTitle ? styles.resumeButton : undefined}
          >
            <Link
              to={openTarget}
              className={hasResumeTitle ? styles.resumeLink : styles.singleLineLink}
            >
              {hasResumeTitle ? (
                <>
                  <span className={styles.resumePrimary}>
                    {t('dashboardHome.resume')}
                    <ArrowRight aria-hidden="true" />
                  </span>
                  <span className={styles.resumeSecondary}>({rememberedItinerary?.title})</span>
                </>
              ) : (
                <>
                  {t('dashboardHome.openItineraries')}
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Link>
          </Button>
        </section>
      </div>
    </AppShell>
  )
}
