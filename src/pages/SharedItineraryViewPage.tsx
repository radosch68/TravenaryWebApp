import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ItineraryDaysGrid } from '@/components/itinerary/ItineraryDaysGrid'
import { DayShortcutsRow } from '@/components/itinerary/DayShortcutsRow'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { Button } from '@/components/ui/button'
import { ApiError, type SharedItineraryDetail } from '@/services/contracts'
import { getItinerary, getSharedItinerary } from '@/services/itinerary-service'
import { formatLocalDate, getTodayLocalIsoDate } from '@/utils/date-format'
import type { LoadState } from '@/utils/load-state'
import { getOngoingProgress, getUpcomingDaysLeft } from '@/utils/trip-progress'

import styles from './ItineraryViewPage.module.css'

export function SharedItineraryViewPage(): ReactElement {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [searchParams] = useSearchParams()
  // Dev-only: /s/preview?itineraryId=<id> renders one of your own itineraries
  // through the exact shared (read-only) layout, without minting a share token.
  const devPreviewItineraryId =
    import.meta.env.DEV && shareToken === 'preview' ? searchParams.get('itineraryId') : null
  const { t, i18n } = useTranslation(['common', 'errors'])
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])
  const nowDate = useMemo(() => new Date(), [])

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<SharedItineraryDetail | null>(null)
  const loadRequestSequenceRef = useRef(0)

  const loadItinerary = useCallback(async (): Promise<void> => {
    const requestSequence = loadRequestSequenceRef.current + 1
    loadRequestSequenceRef.current = requestSequence

    if (!shareToken || (shareToken === 'preview' && !devPreviewItineraryId)) {
      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      setItinerary(null)
      setLoadState('not-found')
      return
    }

    setItinerary(null)
    setLoadState('loading')

    try {
      const payload = devPreviewItineraryId
        ? await getItinerary(devPreviewItineraryId)
        : await getSharedItinerary(shareToken)

      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      setItinerary(payload)
      setLoadState('ready')
    } catch (error) {
      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      if (error instanceof ApiError && error.status === 404) {
        setItinerary(null)
        setLoadState('not-found')
        return
      }

      setItinerary(null)
      setLoadState('error')
    }
  }, [shareToken, devPreviewItineraryId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadItinerary()
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [loadItinerary])

  const dateRangeLabel = useMemo(() => {
    if (!itinerary) {
      return ''
    }

    if (itinerary.startDate && itinerary.endDate) {
      return `${formatLocalDate(itinerary.startDate, i18n.language)} - ${formatLocalDate(itinerary.endDate, i18n.language)}`
    }

    if (itinerary.startDate) {
      return formatLocalDate(itinerary.startDate, i18n.language)
    }

    if (itinerary.endDate) {
      return formatLocalDate(itinerary.endDate, i18n.language)
    }

    return t('itineraryView.noDate')
  }, [i18n.language, itinerary, t])

  const itineraryMapPins = useMemo(() => {
    if (!itinerary) {
      return []
    }

    return buildLocationMapPinsFromDays(itinerary.days)
  }, [itinerary])

  const upcomingDaysLeft = useMemo(
    () => getUpcomingDaysLeft(itinerary?.startDate, todayIsoDate),
    [itinerary?.startDate, todayIsoDate],
  )

  const ongoingProgress = useMemo(
    () => getOngoingProgress(itinerary?.startDate, itinerary?.endDate, itinerary?.days.length ?? 0, nowDate),
    [itinerary?.days.length, itinerary?.endDate, itinerary?.startDate, nowDate],
  )

  const itineraryMapRoute = shareToken ? `/s/${shareToken}/map` : null

  return (
    <main className={styles.sharedPage}>
      <div className={styles.sharedContainer}>
        {loadState === 'loading' ? (
          <section className={styles.stateCard}>
            <p>{t('common:loading')}</p>
          </section>
        ) : null}

        {loadState === 'error' ? (
          <section className={styles.stateCard}>
            <p className={styles.errorText}>{t('errors:server')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadItinerary()
              }}
            >
              <RefreshCw aria-hidden="true" />
              {t('itineraryView.retry')}
            </Button>
          </section>
        ) : null}

        {loadState === 'not-found' ? (
          <section className={styles.stateCard}>
            <p>{t('itineraryView.notFound')}</p>
            <Button type="button" asChild variant="outline" size="sm">
              <Link to="/signin">{t('auth:actions.signIn')}</Link>
            </Button>
          </section>
        ) : null}

        {loadState === 'ready' && itinerary ? (
          <div className={styles.page}>
            <section className={styles.headerCard}>
              <div className={styles.headerMain}>
                <p className={styles.kicker}>{t('itineraryView.sharedKicker')}</p>
                <h1 className={styles.title}>{itinerary.title}</h1>
                {itinerary.description ? <p className={styles.description}>{itinerary.description}</p> : null}

                <div className={styles.metaRow}>
                  <span className={styles.metaPill}>{dateRangeLabel}</span>
                  <span className={styles.metaPill}>
                    {t('itineraryView.dayCount', { count: itinerary.days.length })}
                  </span>
                  {upcomingDaysLeft ? (
                    <span className={`${styles.metaPill} ${styles.metaPillUpcoming}`}>
                      {t('dashboard.daysLeft', { count: upcomingDaysLeft })}
                    </span>
                  ) : null}
                </div>

                {ongoingProgress ? (
                  <div className={styles.ongoingProgressHeader}>
                    <div className={styles.ongoingProgressMeta}>
                      <span className={styles.ongoingProgressLabel}>{t('dashboard.ongoingProgress')}</span>
                    </div>
                    <div
                      className={styles.ongoingProgressTrack}
                      role="progressbar"
                      aria-label={t('dashboard.ongoingProgress')}
                      aria-valuemin={0}
                      aria-valuemax={ongoingProgress.totalHours}
                      aria-valuenow={ongoingProgress.hoursLeft}
                      aria-valuetext={t('dashboard.hoursLeft', { count: ongoingProgress.hoursLeft })}
                    >
                      <div
                        className={styles.ongoingProgressFill}
                        style={{ width: `${ongoingProgress.elapsedPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {itinerary.tags.length > 0 ? (
                  <div className={styles.tagsRow}>
                    {itinerary.tags.map((tag) => (
                      <span key={tag} className={styles.tagChip}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {itinerary.coverPhoto?.url ? (
                <img
                  className={styles.coverPhoto}
                  src={itinerary.coverPhoto.url}
                  alt={itinerary.coverPhoto.caption ?? itinerary.title}
                  title={itinerary.coverPhoto.caption ?? itinerary.title}
                  loading="lazy"
                />
              ) : null}

              {itineraryMapPins.length > 0 ? (
                <ItineraryMapLauncher
                  className={styles.headerMap}
                  pins={itineraryMapPins}
                  title={t('itineraryView.itineraryMapTitle')}
                  emptyLabel={t('itineraryView.mapNoMarkedLocations')}
                  openLabel={t('itineraryView.openFullMap')}
                  to={itineraryMapRoute}
                />
              ) : null}

              <DayShortcutsRow days={itinerary.days} locale={i18n.language} />
            </section>

            <ItineraryDaysGrid
              days={itinerary.days}
              locale={i18n.language}
              fullBleedOnMobile
              buildDayMapRoute={(dayNumber) => `/s/${shareToken}/map?dayNumber=${dayNumber}`}
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}
