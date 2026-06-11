import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { LocationsMap } from '@/components/itinerary/LocationsMap'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ApiError, type ItineraryDetail, type SharedItineraryDetail } from '@/services/contracts'
import { getItinerary, getSharedItinerary } from '@/services/itinerary-service'
import { updateLastOpenedItinerary } from '@/services/profile-service'
import { useProfileStore } from '@/store/profile-store'
import type { LoadState } from '@/utils/load-state'

import styles from './ItineraryMapPage.module.css'

type MapItinerary = Pick<ItineraryDetail, 'id' | 'title' | 'days'>

type ItineraryMapData<T extends MapItinerary> = {
  loadState: LoadState
  itinerary: T | null
  loadItinerary: () => Promise<void>
  selectedDay: T['days'][number] | null
  mapPins: ReturnType<typeof buildLocationMapPinsFromDays>
}

function useItineraryMapData<T extends MapItinerary>(
  routeKey: string | undefined,
  fetchItinerary: (routeKey: string) => Promise<T>,
): ItineraryMapData<T> {
  const [searchParams] = useSearchParams()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<T | null>(null)
  const loadRequestSequenceRef = useRef(0)

  const loadItinerary = useCallback(async (): Promise<void> => {
    const requestSequence = loadRequestSequenceRef.current + 1
    loadRequestSequenceRef.current = requestSequence

    if (!routeKey) {
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
      const payload = await fetchItinerary(routeKey)

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
  }, [routeKey, fetchItinerary])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadItinerary()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadItinerary])

  const requestedDayNumber = useMemo(() => {
    const rawDayNumber = searchParams.get('dayNumber')
    if (!rawDayNumber) {
      return null
    }

    const parsedDayNumber = Number.parseInt(rawDayNumber, 10)
    if (!Number.isFinite(parsedDayNumber) || parsedDayNumber < 1) {
      return null
    }

    return parsedDayNumber
  }, [searchParams])

  const selectedDay = useMemo(() => {
    if (!itinerary || requestedDayNumber === null) {
      return null
    }

    return itinerary.days.find((day) => day.dayNumber === requestedDayNumber) ?? null
  }, [itinerary, requestedDayNumber])

  const mapPins = useMemo(() => {
    if (!itinerary) {
      return []
    }

    if (selectedDay) {
      return buildLocationMapPinsFromDays([selectedDay])
    }

    return buildLocationMapPinsFromDays(itinerary.days)
  }, [itinerary, selectedDay])

  return { loadState, itinerary, loadItinerary, selectedDay, mapPins }
}

type ItineraryMapPanelProps = {
  itinerary: MapItinerary
  selectedDay: MapItinerary['days'][number] | null
  mapPins: ReturnType<typeof buildLocationMapPinsFromDays>
  backToViewRoute: string
}

function ItineraryMapPanel({ itinerary, selectedDay, mapPins, backToViewRoute }: ItineraryMapPanelProps): ReactElement {
  const { t } = useTranslation(['common'])

  const mapTitle = selectedDay
    ? t('itineraryView.dailyMapTitle', { dayNumber: selectedDay.dayNumber })
    : t('itineraryView.itineraryMapTitle')

  return (
    <section className={styles.mapPanel} aria-label={mapTitle}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.kicker}>{itinerary.title}</p>
          <h1 className={styles.title}>{mapTitle}</h1>
          <p className={styles.subtitle}>{t('itineraryView.mapPinsCount', { count: mapPins.length })}</p>
        </div>

        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={backToViewRoute}>{t('itineraryView.backToView')}</Link>
        </Button>
      </header>

      {mapPins.length > 0 ? (
        <LocationsMap pins={mapPins} variant="page" />
      ) : (
        <p className={styles.subtitle}>{t('itineraryView.mapNoMarkedLocations')}</p>
      )}
    </section>
  )
}

export function ItineraryMapPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const { t } = useTranslation(['common', 'errors'])
  const profileLastOpenedItineraryId = useProfileStore((state) => state.lastOpenedItinerary?.itineraryId ?? null)
  const setProfileStore = useProfileStore((state) => state.setProfile)

  const { loadState, itinerary, loadItinerary, selectedDay, mapPins } = useItineraryMapData(itineraryId, getItinerary)

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
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/itineraries">{t('itineraryView.backToListing')}</Link>
          </Button>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <ItineraryMapPanel
          itinerary={itinerary}
          selectedDay={selectedDay}
          mapPins={mapPins}
          backToViewRoute={itinerary ? `/itineraries/${itinerary.id}` : '/itineraries'}
        />
      </div>
    </AppShell>
  )
}

export function SharedItineraryMapPage(): ReactElement {
  const { shareToken } = useParams<{ shareToken: string }>()
  const { t } = useTranslation(['common', 'errors', 'auth'])

  const { loadState, itinerary, loadItinerary, selectedDay, mapPins } = useItineraryMapData<SharedItineraryDetail>(
    shareToken,
    getSharedItinerary,
  )

  return (
    <main className={styles.sharedPage}>
      {loadState === 'loading' ? (
        <section className={`${styles.stateCard} ${styles.sharedState}`}>
          <p>{t('common:loading')}</p>
        </section>
      ) : null}

      {loadState === 'error' ? (
        <section className={`${styles.stateCard} ${styles.sharedState}`}>
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
        <section className={`${styles.stateCard} ${styles.sharedState}`}>
          <p>{t('itineraryView.notFound')}</p>
          <Button type="button" asChild variant="outline" size="sm">
            <Link to="/signin">{t('auth:actions.signIn')}</Link>
          </Button>
        </section>
      ) : null}

      {loadState === 'ready' && itinerary ? (
        <ItineraryMapPanel
          itinerary={itinerary}
          selectedDay={selectedDay}
          mapPins={mapPins}
          backToViewRoute={shareToken ? `/s/${shareToken}` : '/signin'}
        />
      ) : null}
    </main>
  )
}
