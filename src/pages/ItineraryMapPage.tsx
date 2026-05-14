import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { LocationsMap } from '@/components/itinerary/LocationsMap'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ApiError, type ItineraryDetail } from '@/services/contracts'
import { getItinerary } from '@/services/itinerary-service'

import styles from './ItineraryMapPage.module.css'

type LoadState = 'loading' | 'ready' | 'error' | 'not-found'

export function ItineraryMapPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation(['common', 'errors'])

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
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
        setItinerary(null)
        setLoadState('not-found')
        return
      }

      setItinerary(null)
      setLoadState('error')
    }
  }, [itineraryId])

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

  const mapTitle = selectedDay
    ? t('itineraryView.dailyMapTitle', { dayNumber: selectedDay.dayNumber })
    : t('itineraryView.itineraryMapTitle')

  const backToViewRoute = itinerary ? `/itineraries/${itinerary.id}` : '/itineraries'

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
      </div>
    </AppShell>
  )
}
