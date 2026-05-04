import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandBanner } from '@/components/BrandBanner'
import { PanelCloseButton } from '@/components/PanelCloseButton'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { PlanningDaySection } from '@/components/itinerary/PlanningDaySection'
import { buildLocationMapPinsFromActivities } from '@/components/itinerary/location-map-pins'
import type { LocationMapPin } from '@/components/itinerary/location-map-pins'
import { ApiError } from '@/services/contracts'
import { getSharedItinerary } from '@/services/itinerary-service'
import type { SharedItineraryDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'

export function SharedDayDetailPage(): ReactElement {
  const { shareToken, dayNumber: dayNumberParam } = useParams<{ shareToken: string; dayNumber: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<SharedItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found' | 'day-not-found'>('loading')

  const hasValidDayNumberParam = typeof dayNumberParam === 'string' && /^\d+$/.test(dayNumberParam)
  const dayNum = hasValidDayNumberParam ? parseInt(dayNumberParam, 10) : NaN

  const day = useMemo(() => {
    if (!itinerary || Number.isNaN(dayNum)) return null
    return itinerary.days.find((item) => item.dayNumber === dayNum) ?? null
  }, [dayNum, itinerary])

  const loadShared = useCallback(async (): Promise<void> => {
    if (!shareToken || !hasValidDayNumberParam) {
      setState('not-found')
      return
    }

    setState('loading')
    try {
      const payload = await getSharedItinerary(shareToken)
      setItinerary(payload)

      if (!payload.days.some((item) => item.dayNumber === dayNum)) {
        setState('day-not-found')
        return
      }

      setState('ready')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
        setState('not-found')
        return
      }
      setState('error')
    }
  }, [dayNum, hasValidDayNumberParam, shareToken])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadShared()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [loadShared])

  const dayMapPins = useMemo<LocationMapPin[]>(() => {
    if (!day) {
      return []
    }

    return buildLocationMapPinsFromActivities(day.activities, {
      getActivityTypeLabel: (activityType) => t(`common:itinerary.dayEditor.activityTypeOptions.${activityType}`),
    })
  }, [day, t])

  if (state === 'loading') {
    return (
      <main className="app-shell shared-page">
        <header className="shared-page__header"><BrandBanner /></header>
        <section className="panel">
          <p>{t('common:itinerary.detailLoading')}</p>
        </section>
      </main>
    )
  }

  if (state === 'not-found') {
    return (
      <main className="app-shell shared-page">
        <header className="shared-page__header"><BrandBanner /></header>
        <section className="panel">
          <h1>{t('common:itinerary.share.sharedNotFound')}</h1>
          <p>{t('common:itinerary.share.sharedNotFoundMessage')}</p>
        </section>
      </main>
    )
  }

  if (state === 'error' || !itinerary) {
    return (
      <main className="app-shell shared-page">
        <header className="shared-page__header"><BrandBanner /></header>
        <section className="panel">
          <h1>{t('common:itinerary.share.sharedLoadError')}</h1>
          <button type="button" onClick={() => void loadShared()}>
            {t('common:itinerary.retry')}
          </button>
        </section>
      </main>
    )
  }

  if (state === 'day-not-found' || !day) {
    return (
      <main className="app-shell shared-page">
        <header className="shared-page__header"><BrandBanner /></header>
        <section className="panel">
          <p>{t('common:itinerary.dayEditor.dayNotFound')}</p>
          <Link to={`/s/${shareToken}`}>{t('common:back')}</Link>
        </section>
      </main>
    )
  }

  const dayTitle = day.date
    ? `${formatWeekday(day.date, i18n.language)} ${formatLocalDate(day.date, i18n.language)}`
    : `— ${t('common:itinerary.missingDate')}`

  return (
    <main className="app-shell shared-page">
      <header className="shared-page__header"><BrandBanner /></header>
      <section className="panel day-detail-panel">
        <div className="day-detail-panel__top-actions">
          <PanelCloseButton
            ariaLabel={t('common:back')}
            onClick={() => navigate(`/s/${shareToken}`)}
          />
        </div>
        <h1 className="day-detail-panel__heading">{dayTitle}</h1>

        {day.summary ? <p className="day-detail-panel__summary">{day.summary}</p> : null}

        <ItineraryMapLauncher
          pins={dayMapPins}
          title={t('common:itinerary.dayEditor.dailyMapTitle')}
          emptyLabel={t('common:itinerary.dayEditor.mapNoMarkedLocations')}
          openLabel={t('common:itinerary.dayEditor.openFullMap')}
          to={`/s/${shareToken}/days/${day.dayNumber}/map`}
        />

        <PlanningDaySection
          day={day}
          dayIndex={day.dayNumber - 1}
          totalDays={itinerary.days.length}
          disabled
          showDropSlots={false}
          referenceDisplayMode="thumbnails"
        />

        <div className="day-detail-panel__bottom-actions">
          <PanelCloseButton
            ariaLabel={t('common:back')}
            onClick={() => navigate(`/s/${shareToken}`)}
          />
        </div>
      </section>
    </main>
  )
}
