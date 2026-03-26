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
          <div className="itinerary-card__cover itinerary-card__cover--empty" aria-hidden="true" />
        )}
        <div className="itinerary-card__body">
          <div className="itinerary-card__headline">
            <h3>{itinerary.title}</h3>
            <span className="itinerary-card__visibility">
              {t(`common:itinerary.visibility.${itinerary.visibility}`)}
            </span>
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
