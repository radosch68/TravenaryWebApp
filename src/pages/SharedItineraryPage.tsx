import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandBanner } from '@/components/BrandBanner'
import { ItineraryActivityBenchSummary } from '@/components/itinerary/ItineraryActivityBenchSummary'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { ItineraryTimelineView } from '@/components/itinerary/ItineraryTimelineView'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import type { LocationMapPin } from '@/components/itinerary/location-map-pins'
import { ApiError } from '@/services/contracts'
import { getSharedItinerary } from '@/services/itinerary-service'
import type { SharedItineraryDetail } from '@/services/contracts'
import { formatLocalDate } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

export function SharedItineraryPage(): ReactElement {
  const { shareToken } = useParams<{ shareToken: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<SharedItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')

  const loadShared = useCallback(async (): Promise<void> => {
    if (!shareToken) {
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
  }, [shareToken])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadShared()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [loadShared])

  const itineraryMapPins = useMemo<LocationMapPin[]>(() => {
    if (!itinerary) {
      return []
    }

    return buildLocationMapPinsFromDays(itinerary.days, {
      getActivityTypeLabel: (activityType) => t(`common:itinerary.dayEditor.activityTypeOptions.${activityType}`),
    })
  }, [itinerary, t])

  const handleOpenDayDetail = useCallback((dayNumber: number): void => {
    if (!shareToken) {
      return
    }

    navigate(`/s/${shareToken}/days/${dayNumber}`)
  }, [navigate, shareToken])

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

  return (
    <main className="app-shell shared-page">
      <header className="shared-page__header"><BrandBanner /></header>

      <section className="panel itinerary-detail-panel">
        {itinerary.coverPhoto?.url ? (
          <div className="itinerary-detail-cover">
            <img
              src={unsplashUrl(itinerary.coverPhoto.url, 1200, 85)}
              alt={itinerary.coverPhoto.caption ?? itinerary.title}
              title={itinerary.coverPhoto.caption ?? itinerary.title}
            />
            {itinerary.coverPhoto.caption ? (
              <p className="itinerary-detail-cover__caption">{itinerary.coverPhoto.caption}</p>
            ) : null}
          </div>
        ) : null}

        <h1>{itinerary.title}</h1>
        {itinerary.description ? <p>{itinerary.description}</p> : null}

        {itinerary.tags.length > 0 ? (
          <div className="itinerary-tags itinerary-tags--detail" aria-label={t('common:itinerary.tagsAriaLabel')}>
            <svg className="itinerary-tags__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 10L13 3H6L3 6V13L10 20L20 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="7.8" cy="7.8" r="1.6" fill="currentColor" />
            </svg>
            <div className="itinerary-tags__list">
              {itinerary.tags.map((tag) => (
                <span key={tag} className="itinerary-tag-chip">{tag}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="itinerary-detail-meta-grid">
          <span className="itinerary-detail-meta-grid__left">
            {itinerary.startDate ? formatLocalDate(itinerary.startDate, i18n.language) : t('common:itinerary.missingDate')}
          </span>
          <span className="itinerary-detail-meta-grid__right itinerary-detail-day-count">
            {t('common:itinerary.dayCount', { count: itinerary.days.length })}
          </span>
          <span className="itinerary-detail-meta-grid__left">
            {itinerary.endDate ? formatLocalDate(itinerary.endDate, i18n.language) : t('common:itinerary.missingDate')}
          </span>
        </div>

        <ItineraryMapLauncher
          pins={itineraryMapPins}
          title={t('common:itinerary.dayEditor.itineraryMapTitle')}
          emptyLabel={t('common:itinerary.dayEditor.mapNoMarkedLocations')}
          openLabel={t('common:itinerary.dayEditor.openFullMap')}
          to={`/s/${shareToken}/map`}
        />

        <ItineraryActivityBenchSummary activityBench={itinerary.activityBench} />

        <ItineraryTimelineView
          itinerary={itinerary}
          onOpenDay={handleOpenDayDetail}
          referenceDisplayMode="thumbnails"
          contentMode="planning-blocks"
        />

        <p className="shared-page__footer">{t('common:itinerary.share.poweredBy')}</p>
      </section>
    </main>
  )
}
