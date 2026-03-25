import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { ItinerarySummary } from '@/services/contracts'

interface ItinerarySummaryCardProps {
  itinerary: ItinerarySummary
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return ''
  }

  if (startDate && endDate) {
    return `${startDate} - ${endDate}`
  }

  return startDate || endDate || ''
}

export function ItinerarySummaryCard({ itinerary }: ItinerarySummaryCardProps): ReactElement {
  const { t } = useTranslation(['common'])
  const dateLabel = formatDateRange(itinerary.startDate, itinerary.endDate)

  return (
    <li className="itinerary-card">
      <Link className="itinerary-card__main" to={`/itineraries/${itinerary.id}`}>
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
          <span>
            {itinerary.coverPhoto?.url
              ? t('common:itinerary.coverPresent')
              : t('common:itinerary.coverMissing')}
          </span>
        </div>
      </Link>
    </li>
  )
}
