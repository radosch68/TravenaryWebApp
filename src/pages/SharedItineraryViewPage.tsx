import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { ItineraryDaysGrid } from '@/components/itinerary/ItineraryDaysGrid'
import { DayShortcutsRow } from '@/components/itinerary/DayShortcutsRow'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { Button } from '@/components/ui/button'
import { ApiError, type SharedItineraryDetail } from '@/services/contracts'
import { getSharedItinerary } from '@/services/itinerary-service'
import { formatLocalDate, parseIsoDate } from '@/utils/date-format'

import styles from './ItineraryViewPage.module.css'

type LoadState = 'loading' | 'ready' | 'error' | 'not-found'

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function getUpcomingDaysLeft(startDate: string | undefined, todayIsoDate: string): number | null {
  if (!startDate || startDate <= todayIsoDate) {
    return null
  }

  const [todayYear, todayMonth, todayDay] = todayIsoDate.split('-').map(Number)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  const difference = Math.floor((startUtc - todayUtc) / millisecondsPerDay)
  return difference > 0 ? difference : null
}

type OngoingProgress = {
  totalHours: number
  hoursLeft: number
  elapsedPercent: number
}

function getOngoingProgress(
  startDate: string | undefined,
  endDate: string | undefined,
  dayCount: number,
  nowDate: Date,
): OngoingProgress | null {
  if (!startDate || !endDate || dayCount <= 0) {
    return null
  }

  const start = parseIsoDate(startDate)
  const endExclusive = parseIsoDate(endDate)
  start.setHours(0, 0, 0, 0)
  endExclusive.setHours(0, 0, 0, 0)
  endExclusive.setDate(endExclusive.getDate() + 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return null
  }

  if (nowDate < start || nowDate >= endExclusive) {
    return null
  }

  const totalHours = dayCount * 24
  const millisecondsPerHour = 60 * 60 * 1000
  const rawHoursLeft = (endExclusive.getTime() - nowDate.getTime()) / millisecondsPerHour
  const hoursLeft = Math.max(0, Math.min(totalHours, Math.ceil(rawHoursLeft)))
  const elapsedHours = Math.max(0, totalHours - hoursLeft)
  const elapsedPercent = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  return {
    totalHours,
    hoursLeft,
    elapsedPercent,
  }
}

export function SharedItineraryViewPage(): ReactElement {
  const { shareToken } = useParams<{ shareToken: string }>()
  const { t, i18n } = useTranslation(['common', 'errors'])
  const todayIsoDate = useMemo(() => getTodayIsoDate(), [])
  const nowDate = useMemo(() => new Date(), [])

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<SharedItineraryDetail | null>(null)
  const loadRequestSequenceRef = useRef(0)

  const loadItinerary = useCallback(async (): Promise<void> => {
    const requestSequence = loadRequestSequenceRef.current + 1
    loadRequestSequenceRef.current = requestSequence

    if (!shareToken) {
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
      const payload = await getSharedItinerary(shareToken)

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
  }, [shareToken])

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
