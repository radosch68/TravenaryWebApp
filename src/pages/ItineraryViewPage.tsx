import { Edit3, RefreshCw, Trash2 } from 'lucide-react'
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
import { ApiError, type ItineraryDetail } from '@/services/contracts'
import { updateLastOpenedItinerary } from '@/services/profile-service'
import { deleteItinerary, getItinerary } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { formatLocalDate } from '@/utils/date-format'

import styles from './ItineraryViewPage.module.css'

type LoadState = 'loading' | 'ready' | 'error' | 'not-found'

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

  const itineraryMapRoute = itinerary ? `/itineraries/${itinerary.id}/map` : null

  const handleCollapseAllDays = useCallback((): void => {
    setDayCollapseCommandMode('collapse-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
  }, [])

  const handleExpandAllDays = useCallback((): void => {
    setDayCollapseCommandMode('expand-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
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
            </div>

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

          <div className={styles.headerActions}>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/itineraries/${itinerary.id}/edit`)}
            >
              <Edit3 aria-hidden="true" />
              {t('itineraryView.edit')}
            </Button>
          </div>

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
          fullBleedOnMobile
          buildDayMapRoute={(dayNumber) => `/itineraries/${itinerary.id}/map?dayNumber=${dayNumber}`}
          collapseCommandToken={dayCollapseCommandToken}
          collapseCommandMode={dayCollapseCommandMode}
          onCollapseStateChange={setDayCollapseState}
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
