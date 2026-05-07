import { ArrowRight, LayoutDashboard } from 'lucide-react'
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
  const name = displayName || email

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

          <Button type="button" asChild size="sm">
            <Link to="/itineraries">
              <LayoutDashboard aria-hidden="true" />
              {t('dashboardHome.openItineraries')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>
    </AppShell>
  )
}
