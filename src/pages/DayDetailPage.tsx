import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ApiError } from '@/services/contracts'
import { getItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail, ItineraryDay } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'

export function DayDetailPage(): ReactElement {
  const { itineraryId, dayNumber } = useParams<{ itineraryId: string; dayNumber: string }>()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!itineraryId) {
      setState('not-found')
      return
    }

    setState('loading')

    try {
      const payload = await getItinerary(itineraryId)
      setItinerary(payload)
      setState('ready')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState('not-found')
        return
      }

      setState('error')
    }
  }, [itineraryId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDetail()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [loadDetail])

  const day = useMemo<ItineraryDay | null>(() => {
    if (!itinerary || !dayNumber) {
      return null
    }

    const dayNum = parseInt(dayNumber, 10)
    return itinerary.days.find((d) => d.dayNumber === dayNum) ?? null
  }, [itinerary, dayNumber])

  if (state === 'loading') {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <p>{t('common:itinerary.detailLoading')}</p>
        </section>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <h1>{t('common:itinerary.detailLoadErrorTitle')}</h1>
          <p>{t('common:itinerary.detailLoadErrorMessage')}</p>
          <div className="button-row">
            <button type="button" onClick={() => void loadDetail()}>
              {t('common:itinerary.retry')}
            </button>
            <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
          </div>
        </section>
      </main>
    )
  }

  if (state === 'not-found' || !itinerary || !day) {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <h1>{t('common:itinerary.notFoundTitle')}</h1>
          <p>{t('common:itinerary.notFoundMessage')}</p>
          <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb
        items={[
          { icon: 'home', to: '/', ariaLabel: t('common:itinerary.backToDashboard') },
          { label: itinerary.title, to: `/itineraries/${itinerary.id}` },
          { label: t('common:itinerary.dayNumber', { dayNumber: day.dayNumber }) },
        ]}
      />
      <section className="panel">
        <h1>
          {day.date ? formatWeekday(day.date, i18n.language) : '—'} {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
        </h1>
        {day.summary ? <p>{day.summary}</p> : <p>{t('common:itinerary.noDaySummary')}</p>}

        <div className="button-row">
          <Link to={`/itineraries/${itinerary.id}`}>{t('common:back')}</Link>
        </div>
      </section>
    </main>
  )
}
