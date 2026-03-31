import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { ItinerarySummary } from '@/services/contracts'
import { formatDateRange } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

interface ItinerarySummaryCardProps {
  itinerary: ItinerarySummary
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
            src={unsplashUrl(itinerary.coverPhoto.url, 240)}
            alt={itinerary.coverPhoto.caption ?? itinerary.title}
            title={itinerary.coverPhoto.caption ?? itinerary.title}
            loading="lazy"
          />
        ) : (
          <div
            className="itinerary-card__cover itinerary-card__cover--empty"
            role="img"
            aria-label={t('common:itinerary.coverMissing')}
          >
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
          {itinerary.tags.length > 0 ? (
            <div className="itinerary-tags" aria-label={t('common:itinerary.tagsAriaLabel')}>
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
          <div className="itinerary-card__meta">
            <span>{t('common:itinerary.dayCount', { count: itinerary.dayCount })}</span>
            <span>{t('common:itinerary.activityCount', { count: itinerary.activityCount })}</span>
          </div>
        </div>
      </Link>
    </li>
  )
}
