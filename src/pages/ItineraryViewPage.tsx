import { RefreshCw, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { ItineraryDaysGrid } from '@/components/itinerary/ItineraryDaysGrid'
import { DayShortcutsRow } from '@/components/itinerary/DayShortcutsRow'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { ShareButton } from '@/components/itinerary/ShareButton'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ApiError, type DayDocumentNode, type ItineraryActivity, type ItineraryDay, type ItineraryDetail } from '@/services/contracts'
import { updateLastOpenedItinerary } from '@/services/profile-service'
import { deleteItinerary, getItinerary, updateItineraryDay } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { formatLocalDate, parseIsoDate } from '@/utils/date-format'

import styles from './ItineraryViewPage.module.css'

type LoadState = 'loading' | 'ready' | 'error' | 'not-found'

type DaySavePayload = Omit<ItineraryDay, 'date'>

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function toActivitySavePayload(activity: ItineraryActivity): ItineraryActivity {
  if (activity.type === 'accommodation' && !activity.details) {
    return {
      ...activity,
      details: {
        nights: 1,
      },
    }
  }

  if (activity.type === 'tour' && !activity.details?.guidanceMode) {
    return {
      ...activity,
      details: {
        ...activity.details,
        guidanceMode: 'selfGuided',
      },
    }
  }

  return activity
}

function toDocumentSavePayload(nodes: DayDocumentNode[]): DayDocumentNode[] {
  return nodes.map((node) => {
    const nextNode: DayDocumentNode = {
      ...node,
      attrs: node.attrs ? { ...node.attrs } : undefined,
      content: node.content ? toDocumentSavePayload(node.content) : undefined,
    }

    if (nextNode.type === 'activityTile' && nextNode.attrs?.activity) {
      const activity = nextNode.attrs.activity as ItineraryActivity
      nextNode.attrs.activity = toActivitySavePayload(activity)
    }

    return nextNode
  })
}

function mergeSavedDayIntoLatestItinerary(
  latestItinerary: ItineraryDetail,
  savedItinerary: ItineraryDetail,
  dayNumber: number,
): ItineraryDetail {
  const savedDay = savedItinerary.days.find((day) => day.dayNumber === dayNumber)
  if (!savedDay) {
    return latestItinerary
  }

  let replaced = false
  const mergedDays = latestItinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) {
      return day
    }

    replaced = true
    return savedDay
  })

  if (!replaced) {
    return latestItinerary
  }

  return {
    ...latestItinerary,
    schemaVer: savedItinerary.schemaVer,
    updatedAt: savedItinerary.updatedAt,
    days: mergedDays,
  }
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

export function ItineraryViewPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common', 'errors'])
  const profileLastOpenedItineraryId = useProfileStore((state) => state.lastOpenedItinerary?.itineraryId ?? null)
  const setProfileStore = useProfileStore((state) => state.setProfile)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [dayCollapseCommandToken, setDayCollapseCommandToken] = useState(0)
  const [dayCollapseCommandMode, setDayCollapseCommandMode] = useState<'collapse-all' | 'expand-all' | undefined>(undefined)
  const [dayCollapseState, setDayCollapseState] = useState({ allCollapsed: false, allExpanded: true })
  const loadRequestSequenceRef = useRef(0)
  const itineraryRef = useRef<ItineraryDetail | null>(null)
  const daySaveSequenceByDayRef = useRef<Record<number, number>>({})
  const todayIsoDate = useMemo(() => getTodayIsoDate(), [])
  const nowDate = useMemo(() => new Date(), [])

  useEffect(() => {
    itineraryRef.current = itinerary
  }, [itinerary])

  const loadItinerary = useCallback(async (): Promise<void> => {
    const requestSequence = loadRequestSequenceRef.current + 1
    loadRequestSequenceRef.current = requestSequence

    if (!itineraryId) {
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
      const payload = await getItinerary(itineraryId)

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
        setLoadState('not-found')
        return
      }

      setLoadState('error')
    }
  }, [itineraryId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadItinerary()
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [loadItinerary])

  useEffect(() => {
    if (!itinerary?.id) {
      return
    }

    if (profileLastOpenedItineraryId === itinerary.id) {
      return
    }

    void updateLastOpenedItinerary(itinerary.id)
      .then((updatedProfile) => {
        setProfileStore(
          updatedProfile.displayName ?? null,
          updatedProfile.email,
          updatedProfile.lastOpenedItinerary ?? null,
        )
      })
      .catch(() => {
        // Non-fatal: profile refresh will eventually re-sync persisted resume target.
      })
  }, [itinerary?.id, profileLastOpenedItineraryId, setProfileStore])

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

  const itineraryMapRoute = itinerary ? `/itineraries/${itinerary.id}/map` : null

  const handleCollapseAllDays = useCallback((): void => {
    setDayCollapseCommandMode('collapse-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
  }, [])

  const handleExpandAllDays = useCallback((): void => {
    setDayCollapseCommandMode('expand-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
  }, [])

  const handleDaySave = useCallback(async (updatedDay: DaySavePayload): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary) {
      return
    }

    const saveSequence = (daySaveSequenceByDayRef.current[updatedDay.dayNumber] ?? 0) + 1
    daySaveSequenceByDayRef.current[updatedDay.dayNumber] = saveSequence
    const nextDays = currentItinerary.days.map((day) =>
      day.dayNumber === updatedDay.dayNumber
        ? {
            ...day,
            ...updatedDay,
          }
        : day,
    )
    const optimisticItinerary = {
      ...currentItinerary,
      days: nextDays,
    }

    itineraryRef.current = optimisticItinerary
    setItinerary(optimisticItinerary)

    const savedItinerary = await updateItineraryDay(currentItinerary.id, updatedDay.dayNumber, {
      summary: updatedDay.summary,
      document: toDocumentSavePayload(updatedDay.document ?? []),
    })

    if (daySaveSequenceByDayRef.current[updatedDay.dayNumber] !== saveSequence) {
      return
    }

    const latestItinerary = itineraryRef.current
    if (!latestItinerary) {
      return
    }

    const reconciledItinerary = mergeSavedDayIntoLatestItinerary(
      latestItinerary,
      savedItinerary,
      updatedDay.dayNumber,
    )

    itineraryRef.current = reconciledItinerary
    setItinerary(reconciledItinerary)
  }, [])

  async function onDelete(): Promise<void> {
    if (!itinerary || isDeleting) {
      return
    }

    setIsDeleting(true)
    setDeleteError(false)

    try {
      await deleteItinerary(itinerary.id)
      navigate('/itineraries')
    } catch {
      setDeleteError(true)
    } finally {
      setIsDeleting(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <AppShell>
        <section className={styles.stateCard}>
          <p>{t('common:loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (loadState === 'error') {
    return (
      <AppShell>
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
      </AppShell>
    )
  }

  if (loadState === 'not-found' || !itinerary) {
    return (
      <AppShell>
        <section className={styles.stateCard}>
          <p>{t('itineraryView.notFound')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/itineraries')}>
            {t('itineraryView.backToListing')}
          </Button>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerMain}>
            <div className={styles.kickerRow}>
              <p className={styles.kicker}>{t('itineraryView.ownerKicker')}</p>

              <div className={styles.headerTopActions}>
                <ShareButton
                  itineraryId={itinerary.id}
                  hasShareLink={itinerary.hasShareLink}
                  onShareChange={(hasShareLink) => {
                    setItinerary((previousValue) =>
                      previousValue ? { ...previousValue, hasShareLink } : previousValue,
                    )
                  }}
                />
              </div>
            </div>
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

          <ItineraryMapLauncher
            className={styles.headerMap}
            pins={itineraryMapPins}
            title={t('itineraryView.itineraryMapTitle')}
            emptyLabel={t('itineraryView.mapNoMarkedLocations')}
            openLabel={t('itineraryView.openFullMap')}
            to={itineraryMapRoute}
          />

          <DayShortcutsRow days={itinerary.days} locale={i18n.language} />

          {!dayCollapseState.allExpanded || !dayCollapseState.allCollapsed ? (
            <div className={styles.headerDayControls}>
              {!dayCollapseState.allExpanded ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAllDays}
                >
                  {t('itineraryView.expandAllDays')}
                </Button>
              ) : null}

              {!dayCollapseState.allCollapsed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCollapseAllDays}
                >
                  {t('itineraryView.collapseAllDays')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <ItineraryDaysGrid
          days={itinerary.days}
          locale={i18n.language}
          editable
          fullBleedOnMobile
          buildDayMapRoute={(dayNumber) => `/itineraries/${itinerary.id}/map?dayNumber=${dayNumber}`}
          collapseCommandToken={dayCollapseCommandToken}
          collapseCommandMode={dayCollapseCommandMode}
          onCollapseStateChange={setDayCollapseState}
          onDaySave={handleDaySave}
        />

        <section className={styles.dangerZone}>
          <Button
            type="button"
            variant="destructive"
            className={styles.dangerButton}
            disabled={isDeleting}
            onClick={() => {
              const confirmed = window.confirm(t('itineraryView.deleteZoneText'))

              if (!confirmed) {
                return
              }

              void onDelete()
            }}
          >
            <Trash2 aria-hidden="true" />
            {isDeleting ? t('itineraryView.deletingItinerary') : t('itineraryView.deleteItinerary')}
          </Button>

          {deleteError ? <p className={styles.errorText}>{t('itineraryView.deleteError')}</p> : null}
        </section>
      </div>
    </AppShell>
  )
}
