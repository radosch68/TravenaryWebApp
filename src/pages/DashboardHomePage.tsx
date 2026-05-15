import { ArrowRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import type { ItinerarySummary } from '@/services/contracts'
import { listItineraries } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { formatLocalDate, parseIsoDate } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from './DashboardHomePage.module.css'

type TilesLoadState = 'loading' | 'ready' | 'error'

function toValidLocalDate(value?: string): Date | null {
  if (!value) {
    return null
  }

  const parsedDate = parseIsoDate(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  parsedDate.setHours(0, 0, 0, 0)
  return parsedDate
}

export function DashboardHomePage(): ReactElement {
  const { t, i18n } = useTranslation('common')
  const displayName = useProfileStore((state) => state.displayName)
  const email = useProfileStore((state) => state.email)
  const backendLastOpenedItinerary = useProfileStore((state) => state.lastOpenedItinerary)
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([])
  const [tilesLoadState, setTilesLoadState] = useState<TilesLoadState>('loading')

  useEffect(() => {
    let isMounted = true

    async function loadAllItineraries(): Promise<void> {
      setTilesLoadState('loading')

      try {
        const allItems: ItinerarySummary[] = []
        let page = 1
        const limit = 100

        while (page <= 20) {
          const response = await listItineraries({
            page,
            limit,
            sortBy: 'plannedStartDate',
            sortOrder: 'asc',
            includePast: true,
          })

          allItems.push(...response.items)

          if (allItems.length >= response.total || response.items.length === 0) {
            break
          }

          page += 1
        }

        if (!isMounted) {
          return
        }

        setItineraries(allItems)
        setTilesLoadState('ready')
      } catch {
        if (!isMounted) {
          return
        }

        setItineraries([])
        setTilesLoadState('error')
      }
    }

    void loadAllItineraries()

    return () => {
      isMounted = false
    }
  }, [])

  const name = displayName || email
  const rememberedItinerary = backendLastOpenedItinerary?.itineraryId
    ? {
        id: backendLastOpenedItinerary.itineraryId,
        title: backendLastOpenedItinerary.itineraryTitle ?? null,
      }
    : null
  const openTarget = rememberedItinerary?.id ? `/itineraries/${rememberedItinerary.id}` : '/itineraries'
  const hasResumeTitle = Boolean(rememberedItinerary?.title)

  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const upcomingItinerary = useMemo(() => {
    const candidates = itineraries
      .filter((itinerary) => {
        const startDate = toValidLocalDate(itinerary.startDate)
        return Boolean(startDate && startDate > today)
      })
      .sort((left, right) => {
        const leftStart = toValidLocalDate(left.startDate)
        const rightStart = toValidLocalDate(right.startDate)

        if (!leftStart || !rightStart) {
          return 0
        }

        return leftStart.getTime() - rightStart.getTime()
      })

    return candidates[0] ?? null
  }, [itineraries, today])

  const tripDistribution = useMemo(() => {
    let upcoming = 0
    let ongoing = 0
    let completed = 0
    let undated = 0

    itineraries.forEach((itinerary) => {
      const startDate = toValidLocalDate(itinerary.startDate)
      const endDate = toValidLocalDate(itinerary.endDate)

      if (!startDate && !endDate) {
        undated += 1
        return
      }

      if (endDate && endDate < today) {
        completed += 1
        return
      }

      if (startDate && startDate > today) {
        upcoming += 1
        return
      }

      ongoing += 1
    })

    return {
      upcoming,
      ongoing,
      completed,
      undated,
    }
  }, [itineraries, today])

  const upcomingDateLabel = useMemo(() => {
    if (!upcomingItinerary?.startDate) {
      return null
    }

    const startDateLabel = formatLocalDate(upcomingItinerary.startDate, i18n.language)
    if (!upcomingItinerary.endDate) {
      return startDateLabel
    }

    return `${startDateLabel} - ${formatLocalDate(upcomingItinerary.endDate, i18n.language)}`
  }, [i18n.language, upcomingItinerary?.endDate, upcomingItinerary?.startDate])

  const upcomingDaysLeft = useMemo(() => {
    if (!upcomingItinerary?.startDate) {
      return null
    }

    const startDate = toValidLocalDate(upcomingItinerary.startDate)
    if (!startDate) {
      return null
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000
    const difference = Math.round((startDate.getTime() - today.getTime()) / millisecondsPerDay)
    return difference > 0 ? difference : null
  }, [today, upcomingItinerary?.startDate])

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

        <section className={styles.widgetsGrid}>
          <article className={styles.widgetCard}>
            <div className={styles.upcomingHeader}>
              <div className={styles.upcomingHeading}>
                <p className={styles.widgetKicker}>{t('dashboardHome.upcoming.kicker')}</p>
                <h2 className={styles.widgetTitle}>{t('dashboardHome.upcoming.title')}</h2>
              </div>

              {tilesLoadState === 'ready' && upcomingDaysLeft ? (
                <div className={styles.countdownBadge}>
                  <span className={styles.countdownValue}>{upcomingDaysLeft}</span>
                  <span className={styles.countdownLabel}>{t('dashboardHome.upcoming.daysLeft')}</span>
                </div>
              ) : null}
            </div>

            {tilesLoadState === 'loading' ? <p className={styles.widgetMuted}>{t('loading')}</p> : null}
            {tilesLoadState === 'error' ? (
              <p className={styles.widgetMuted}>{t('dashboardHome.upcoming.loadError')}</p>
            ) : null}

            {tilesLoadState === 'ready' && upcomingItinerary ? (
              <Link to={`/itineraries/${upcomingItinerary.id}`} className={styles.upcomingLink}>
                {upcomingItinerary.coverPhoto?.url ? (
                  <img
                    className={styles.upcomingCover}
                    src={unsplashUrl(upcomingItinerary.coverPhoto.url, 640, 78)}
                    alt={upcomingItinerary.coverPhoto.caption || upcomingItinerary.title}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.upcomingCoverPlaceholder}>{t('dashboardHome.upcoming.noCover')}</div>
                )}

                <div className={styles.upcomingMeta}>
                  <p className={styles.upcomingName}>{upcomingItinerary.title}</p>
                  {upcomingDateLabel ? <p className={styles.upcomingDate}>{upcomingDateLabel}</p> : null}
                </div>
              </Link>
            ) : null}

            {tilesLoadState === 'ready' && !upcomingItinerary ? (
              <p className={styles.widgetMuted}>{t('dashboardHome.upcoming.empty')}</p>
            ) : null}
          </article>

          <article className={styles.widgetCard}>
            <p className={styles.widgetKicker}>{t('dashboardHome.distribution.kicker')}</p>
            <h2 className={styles.widgetTitle}>{t('dashboardHome.distribution.title')}</h2>

            {tilesLoadState === 'loading' ? <p className={styles.widgetMuted}>{t('loading')}</p> : null}
            {tilesLoadState === 'error' ? (
              <p className={styles.widgetMuted}>{t('dashboardHome.distribution.loadError')}</p>
            ) : null}

            {tilesLoadState === 'ready' ? (
              <div className={styles.snapshotGrid}>
                <div className={styles.snapshotCell}>
                  <span className={styles.snapshotValue}>{tripDistribution.upcoming}</span>
                  <span className={styles.snapshotLabel}>{t('dashboardHome.distribution.upcoming')}</span>
                </div>
                <div className={styles.snapshotCell}>
                  <span className={styles.snapshotValue}>{tripDistribution.ongoing}</span>
                  <span className={styles.snapshotLabel}>{t('dashboardHome.distribution.ongoing')}</span>
                </div>
                <div className={styles.snapshotCell}>
                  <span className={styles.snapshotValue}>{tripDistribution.completed}</span>
                  <span className={styles.snapshotLabel}>{t('dashboardHome.distribution.completed')}</span>
                </div>
                <div className={styles.snapshotCell}>
                  <span className={styles.snapshotValue}>{tripDistribution.undated}</span>
                  <span className={styles.snapshotLabel}>{t('dashboardHome.distribution.undated')}</span>
                </div>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </AppShell>
  )
}
