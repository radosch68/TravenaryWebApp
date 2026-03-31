import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ApiError } from '@/services/contracts'
import { deleteItinerary, getItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

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

export function ItineraryDetailPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!itineraryId) {
      setState('not-found')
      return
    }

    setState('loading')
    setDeleteError(false)
    setDeleteConfirmOpen(false)

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
        setDeleteConfirmOpen(true)
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
          <p>{t('common:itinerary.detailLoading')}</p>
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
      <Breadcrumb items={[{ icon: 'home', to: '/', ariaLabel: t('common:itinerary.backToDashboard') }, { label: itinerary.title }]} />
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
              <path
                d="M20 10L13 3H6L3 6V13L10 20L20 10Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7.8" cy="7.8" r="1.6" fill="currentColor" />
            </svg>
            <div className="itinerary-tags__list">
              {itinerary.tags.map((tag) => (
                <span key={tag} className="itinerary-tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="itinerary-detail-meta">
          <p>{dateSpan}</p>
          <p>{t('common:itinerary.dayCount', { count: itinerary.days.length })}</p>
        </div>

        <ul className="itinerary-day-list">
          {itinerary.days.map((day, index) => (
            <li
              key={day.dayNumber}
              className={`itinerary-day-list__item itinerary-day-list__item--${index % 2 === 0 ? 'odd' : 'even'}`}
            >
              <Link to={`/itineraries/${itinerary.id}/days/${day.dayNumber}`} className="itinerary-day-link" style={{ display: 'block', color: 'inherit' }}>
                <div className="itinerary-day-header">
                  <span className="itinerary-day-header__weekday">
                    {day.date ? formatWeekday(day.date, i18n.language) : '—'}
                  </span>
                  <span className="itinerary-day-header__date">
                    {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
                  </span>
                  <span className="itinerary-day-header__index">
                    {t('common:itinerary.dayNumber', { dayNumber: day.dayNumber })}
                  </span>
                </div>
                {day.summary ? <p>{day.summary}</p> : null}
              </Link>
            </li>
          ))}
        </ul>

        {deleteError ? <p className="error">{t('common:itinerary.deleteError')}</p> : null}

        <div className="button-row">
          {deleteConfirmOpen ? (
            <>
              <p className="itinerary-delete-confirm">{t('common:itinerary.deleteConfirm')}</p>
              <div className="button-row button-row--inline">
                <button className="button-danger" type="button" onClick={() => void handleDelete()} disabled={deleteBusy}>
                  {deleteBusy ? t('common:itinerary.deleting') : t('common:itinerary.delete')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setDeleteError(false)
                  }}
                  disabled={deleteBusy}
                >
                  {t('common:cancel')}
                </button>
              </div>
            </>
          ) : (
            <button
              className="button-danger"
              type="button"
              onClick={() => {
                setDeleteConfirmOpen(true)
                setDeleteError(false)
              }}
            >
              {t('common:itinerary.delete')}
            </button>
          )}
          <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
        </div>
      </section>
    </main>
  )
}
