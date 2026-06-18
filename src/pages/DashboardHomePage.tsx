import { ArrowRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { NewItineraryTile } from '@/components/common/NewItineraryTile'
import { Button } from '@/components/ui/button'
import type { ItinerarySummary } from '@/services/contracts'
import { listItineraries } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { formatLocalDate } from '@/utils/date-format'
import { selectFeaturedItinerary, toValidLocalDate } from '@/utils/featured-itinerary'
import type { LoadState } from '@/utils/load-state'
import { getOngoingProgress } from '@/utils/trip-progress'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from './DashboardHomePage.module.css'

export function DashboardHomePage(): ReactElement {
  const { t, i18n } = useTranslation('common')
  const displayName = useProfileStore((state) => state.displayName)
  const email = useProfileStore((state) => state.email)
  const backendLastOpenedItinerary = useProfileStore((state) => state.lastOpenedItinerary)
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([])
  const [tilesLoadState, setTilesLoadState] = useState<LoadState>('loading')
  const [nowDate, setNowDate] = useState(() => new Date())

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

  const { featured: featuredItinerary, mode: featuredMode } = useMemo(
    () => selectFeaturedItinerary(itineraries, today),
    [itineraries, today],
  )

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

  const featuredDateLabel = useMemo(() => {
    if (!featuredItinerary?.startDate) {
      return null
    }

    const startDateLabel = formatLocalDate(featuredItinerary.startDate, i18n.language)
    if (!featuredItinerary.endDate) {
      return startDateLabel
    }

    return `${startDateLabel} - ${formatLocalDate(featuredItinerary.endDate, i18n.language)}`
  }, [featuredItinerary, i18n.language])

  const upcomingDaysLeft = useMemo(() => {
    if (featuredMode !== 'upcoming' || !featuredItinerary?.startDate) {
      return null
    }

    const startDate = toValidLocalDate(featuredItinerary.startDate)
    if (!startDate) {
      return null
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000
    const difference = Math.round((startDate.getTime() - today.getTime()) / millisecondsPerDay)
    return difference > 0 ? difference : null
  }, [featuredItinerary, featuredMode, today])

  useEffect(() => {
    if (featuredMode !== 'ongoing') {
      return
    }

    const interval = window.setInterval(() => {
      setNowDate(new Date())
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [featuredMode])

  const featuredOngoingProgress = useMemo(() => {
    if (featuredMode !== 'ongoing' || !featuredItinerary) {
      return null
    }

    return getOngoingProgress(
      featuredItinerary.startDate,
      featuredItinerary.endDate,
      featuredItinerary.dayCount,
      nowDate,
    )
  }, [featuredItinerary, featuredMode, nowDate])

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

          <div className={styles.headerDivider} />

          <div className={styles.headerActionsRow}>
            <Button
              type="button"
              asChild
              size="sm"
              className={`${styles.resumeButton} ${hasResumeTitle ? styles.resumeButtonDetailed : ''}`}
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

            <NewItineraryTile
              className={styles.newItineraryTile}
              newItineraryLabel={t('dashboardHome.newItineraryTile.newItinerary')}
              aiHref="/ai-drafts/new"
              aiLabel={t('dashboardHome.newItineraryTile.ai')}
              manualHref="/itineraries/new/manual"
              manualLabel={t('dashboardHome.newItineraryTile.manual')}
            />
          </div>
        </section>

        <section className={styles.widgetsGrid}>
          <article className={styles.widgetCard}>
            <div className={styles.upcomingHeader}>
              <div className={styles.upcomingHeading}>
                <p className={styles.widgetKicker}>
                  {featuredMode === 'ongoing'
                    ? t('dashboardHome.upcoming.ongoingKicker')
                    : t('dashboardHome.upcoming.kicker')}
                </p>
                <h2 className={styles.widgetTitle}>
                  {featuredMode === 'ongoing'
                    ? t('dashboardHome.upcoming.ongoingTitle')
                    : t('dashboardHome.upcoming.title')}
                </h2>
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

            {tilesLoadState === 'ready' && featuredItinerary ? (
              <Link to={`/itineraries/${featuredItinerary.id}`} className={styles.upcomingLink}>
                {featuredItinerary.coverPhoto?.url ? (
                  <img
                    className={styles.upcomingCover}
                    src={unsplashUrl(featuredItinerary.coverPhoto.url, 640, 78)}
                    alt={featuredItinerary.coverPhoto.caption || featuredItinerary.title}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.upcomingCoverPlaceholder}>{t('dashboardHome.upcoming.noCover')}</div>
                )}

                <div className={styles.upcomingMeta}>
                  <p className={styles.upcomingName}>{featuredItinerary.title}</p>
                  {featuredDateLabel ? <p className={styles.upcomingDate}>{featuredDateLabel}</p> : null}

                  {featuredOngoingProgress ? (
                    <div className={styles.ongoingProgress}>
                      <div className={styles.ongoingProgressMeta}>
                        <span className={styles.ongoingProgressLabel}>{t('dashboard.ongoingProgress')}</span>
                      </div>
                      <div
                        className={styles.ongoingProgressTrack}
                        role="progressbar"
                        aria-label={t('dashboard.ongoingProgress')}
                        aria-valuemin={0}
                        aria-valuemax={featuredOngoingProgress.totalHours}
                        aria-valuenow={featuredOngoingProgress.hoursLeft}
                        aria-valuetext={t('dashboard.hoursLeft', { count: featuredOngoingProgress.hoursLeft })}
                      >
                        <div
                          className={styles.ongoingProgressFill}
                          style={{ width: `${featuredOngoingProgress.elapsedPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </Link>
            ) : null}

            {tilesLoadState === 'ready' && !featuredItinerary ? (
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
