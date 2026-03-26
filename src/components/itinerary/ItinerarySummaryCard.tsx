import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { ItinerarySummary } from '@/services/contracts'

interface ItinerarySummaryCardProps {
  itinerary: ItinerarySummary
}

function formatLocalDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(year, month - 1, day))
}

function formatDateRange(startDate: string | undefined, endDate: string | undefined, locale: string): string {
  if (!startDate && !endDate) {
    return ''
  }

  if (startDate && endDate) {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)

    if (startYear === endYear) {
      const formatMonthDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
      return `${formatMonthDay.format(start)} – ${formatMonthDay.format(end)}`
    }

    return `${formatLocalDate(startDate, locale)} – ${formatLocalDate(endDate, locale)}`
  }

  return formatLocalDate((startDate || endDate) as string, locale)
}

function buildThumbSrc(url: string): string {
  if (url.includes('images.unsplash.com')) {
    return `${url}?w=240&q=80&fit=crop`
  }
  return url
}

export function ItinerarySummaryCard({ itinerary }: ItinerarySummaryCardProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const dateLabel = formatDateRange(itinerary.startDate, itinerary.endDate, i18n.language)

  return (
    <li className="itinerary-card">
      <Link className="itinerary-card__main" to={`/itineraries/${itinerary.id}`}>
        {itinerary.coverPhoto?.url ? (
          <img
            className="itinerary-card__cover"
            src={buildThumbSrc(itinerary.coverPhoto.url)}
            alt={itinerary.coverPhoto.caption ?? itinerary.title}
            loading="lazy"
          />
        ) : (
          <div className="itinerary-card__cover itinerary-card__cover--empty" aria-hidden="true">
            <svg
              className="itinerary-card__placeholder-icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3 18L9 12L13 16L17 12L21 16V20H3V18Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 20V6C3 4.9 3.9 4 5 4H19C20.1 4 21 4.9 21 6V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
        )}
        <div className="itinerary-card__body">
          <div className="itinerary-card__headline">
            <h3>{itinerary.title}</h3>
          </div>
          <p className="itinerary-card__dates">
            {dateLabel.length > 0 ? dateLabel : t('common:itinerary.missingDate')}
          </p>
          <div className="itinerary-card__meta">
            <span>{t('common:itinerary.dayCount', { count: itinerary.dayCount })}</span>
            <span>{t('common:itinerary.activityCount', { count: itinerary.activityCount })}</span>
          </div>
        </div>
      </Link>
    </li>
  )
}
