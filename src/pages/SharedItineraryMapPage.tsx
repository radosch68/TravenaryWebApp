import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandLanguageHeader } from '@/components/BrandLanguageHeader'
import { LocationsMap } from '@/components/itinerary/LocationsMap'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { ApiError } from '@/services/contracts'
import { getSharedItinerary } from '@/services/itinerary-service'
import type { SharedItineraryDetail } from '@/services/contracts'

function SharedMapPageHeader({ shareToken }: { shareToken?: string }): ReactElement {
  return (
    <header className="topbar">
      <BrandLanguageHeader brandLinkTo={shareToken ? `/s/${shareToken}` : undefined} variant="topbar" />
    </header>
  )
}

export function SharedItineraryMapPage(): ReactElement {
  const { shareToken, dayNumber: dayNumberParam } = useParams<{ shareToken: string; dayNumber?: string }>()
  const parsedDayNumber = dayNumberParam ? Number.parseInt(dayNumberParam, 10) : null
  const hasDayFilter = parsedDayNumber !== null && Number.isFinite(parsedDayNumber)
  const { t } = useTranslation(['common'])
  const [itinerary, setItinerary] = useState<SharedItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')

  const loadShared = useCallback(async (): Promise<void> => {
    if (!shareToken || (dayNumberParam !== undefined && !/^\d+$/.test(dayNumberParam))) {
      setState('not-found')
      return
    }

    setState('loading')

    try {
      const payload = await getSharedItinerary(shareToken)
      setItinerary(payload)
      setState('ready')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
        setState('not-found')
        return
      }

      setState('error')
    }
  }, [dayNumberParam, shareToken])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadShared()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadShared])

  const mapPins = useMemo(() => {
    if (!itinerary) {
      return []
    }

    const daySource = hasDayFilter
      ? itinerary.days.filter((day) => day.dayNumber === parsedDayNumber)
      : itinerary.days

    return buildLocationMapPinsFromDays(daySource, {
      getActivityTypeLabel: (activityType) => t(`common:itinerary.dayEditor.activityTypeOptions.${activityType}`),
    })
  }, [hasDayFilter, itinerary, parsedDayNumber, t])

  const mapTitle = hasDayFilter
    ? t('common:itinerary.dayEditor.dailyMapTitle')
    : t('common:itinerary.dayEditor.itineraryMapTitle')

  if (state === 'loading') {
    return (
      <main className="app-shell itinerary-map-page">
        <SharedMapPageHeader shareToken={shareToken} />
        <section className="panel">
          <p>{t('common:itinerary.detailLoading')}</p>
        </section>
      </main>
    )
  }

  if (state === 'not-found') {
    return (
      <main className="app-shell itinerary-map-page">
        <SharedMapPageHeader shareToken={shareToken} />
        <section className="panel">
          <h1>{t('common:itinerary.share.sharedNotFound')}</h1>
          <p>{t('common:itinerary.share.sharedNotFoundMessage')}</p>
        </section>
      </main>
    )
  }

  if (state === 'error' || !itinerary) {
    return (
      <main className="app-shell itinerary-map-page">
        <SharedMapPageHeader shareToken={shareToken} />
        <section className="panel">
          <h1>{t('common:itinerary.share.sharedLoadError')}</h1>
          <div className="button-row">
            <button type="button" className="button-primary" onClick={() => void loadShared()}>
              {t('common:itinerary.retry')}
            </button>
            {shareToken ? <Link to={`/s/${shareToken}`}>{t('common:back')}</Link> : null}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell itinerary-map-page">
      <SharedMapPageHeader shareToken={shareToken} />
      <section className="panel itinerary-map-page__panel" aria-label={mapTitle}>
        <div className="itinerary-map-page__header">
          <div>
            <h1>{mapTitle}</h1>
            <p>{t('common:itinerary.dayEditor.mapPinsCount', { count: mapPins.length })}</p>
          </div>
        </div>

        {mapPins.length > 0 ? (
          <LocationsMap pins={mapPins} variant="page" />
        ) : (
          <p className="text-muted">{t('common:itinerary.dayEditor.mapNoLocations')}</p>
        )}
      </section>
    </main>
  )
}
