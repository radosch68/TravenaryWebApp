import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { ApiError } from '@/services/contracts'
import { deleteItinerary, getItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail } from '@/services/contracts'

function formatLocalDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(year, month - 1, day))
}

function computeDateSpan(days: ItineraryDetail['days'], locale: string): string | undefined {
  const dated = days.map((day) => day.date).filter((value): value is string => Boolean(value))
  if (dated.length === 0) {
    return undefined
  }

  const sorted = [...dated].sort((left, right) => left.localeCompare(right))
  const start = sorted[0]
  const end = sorted[sorted.length - 1]
  return start === end
    ? formatLocalDate(start, locale)
    : `${formatLocalDate(start, locale)} – ${formatLocalDate(end, locale)}`
}

function buildHeroSrc(url: string): string {
  if (url.includes('images.unsplash.com')) {
    return `${url}?w=1200&q=85&fit=crop`
  }
  return url
}

export function ItineraryDetailPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!itineraryId) {
      setState('not-found')
      return
    }

    setState('loading')
    setDeleteError(false)

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
    void loadDetail()
  }, [loadDetail])

  const dateSpan = useMemo(() => {
    if (!itinerary) {
      return ''
    }

    return computeDateSpan(itinerary.days, i18n.language) || t('common:itinerary.missingDate')
  }, [itinerary, t, i18n.language])

  const handleDelete = async (): Promise<void> => {
    if (!itineraryId) {
      return
    }

    const confirmed = window.confirm(t('common:itinerary.deleteConfirm'))
    if (!confirmed) {
      return
    }

    setDeleteBusy(true)
    setDeleteError(false)
    try {
      await deleteItinerary(itineraryId)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState('not-found')
      } else {
        setDeleteError(true)
      }
    } finally {
      setDeleteBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <p>{t('common:itinerary.loading')}</p>
        </section>
      </main>
    )
  }

  if (state === 'not-found') {
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

  if (state === 'error' || !itinerary) {
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

  return (
    <main className="app-shell">
      <Header />
      <section className="panel itinerary-detail-panel">
        {itinerary.coverPhoto?.url ? (
          <div className="itinerary-detail-cover">
            <img
              src={buildHeroSrc(itinerary.coverPhoto.url)}
              alt={itinerary.coverPhoto.caption ?? itinerary.title}
            />
          </div>
        ) : null}
        <h1>{itinerary.title}</h1>
        {itinerary.description ? <p>{itinerary.description}</p> : null}

        <div className="itinerary-detail-meta">
          <p>{dateSpan}</p>
          <p>{t('common:itinerary.dayCount', { count: itinerary.days.length })}</p>
        </div>

        <ul className="itinerary-day-list">
          {itinerary.days.map((day) => (
            <li key={day.dayNumber}>
              <strong>
                {t('common:itinerary.dayNumber', { dayNumber: day.dayNumber })}
              </strong>
              {day.date ? <span>{` · ${formatLocalDate(day.date, i18n.language)}`}</span> : null}
              {day.summary ? <p>{day.summary}</p> : null}
            </li>
          ))}
        </ul>

        {deleteError ? <p className="error">{t('common:itinerary.deleteError')}</p> : null}

        <div className="button-row">
          <button className="button-danger" type="button" onClick={() => void handleDelete()} disabled={deleteBusy}>
            {deleteBusy ? t('common:itinerary.deleting') : t('common:itinerary.delete')}
          </button>
          <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
        </div>
      </section>
    </main>
  )
}
