import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from '@phosphor-icons/react'

import type { ItineraryActivity } from '@/services/contracts'
import { getEffectiveAnchored, sortActivitiesForTimeline } from '@/utils/activity-classification'
import { formatLocalTimeRange } from '@/utils/date-format'
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_COLOR } from './activity-presentation'

interface TimelineDaySectionProps {
  activities: ItineraryActivity[]
}

export function TimelineDaySection({ activities }: TimelineDaySectionProps): ReactElement {
  const { t } = useTranslation(['common'])

  if (activities.length === 0) {
    return (
      <div className="timeline-day-section">
        <p className="itinerary-day-activities__empty">{t('common:itinerary.days.noActivities')}</p>
      </div>
    )
  }

  return (
    <div className="timeline-day-section">
      <ul className="planning-section__list">
        {sortActivitiesForTimeline(activities).map((activity) => (
          <TimelineActivityRow key={activity.id} activity={activity} t={t} />
        ))}
      </ul>
    </div>
  )
}

function TimelineActivityRow({ activity, t }: { activity: ItineraryActivity; t: (key: string) => string }): ReactElement {
  const { i18n } = useTranslation(['common'])
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note

  return (
    <li
      className="timeline-activity"
      style={{
        background: typeColor.bg,
        border: `2px solid ${typeColor.icon}50`,
      }}
    >
      <span className="timeline-activity__time">
        {formatLocalTimeRange(activity.time, activity.timeEnd, i18n.language)}
      </span>
      <span className="timeline-activity__type-icon" style={{ color: typeColor.icon }}>
        {ACTIVITY_TYPE_ICON[activity.type] ?? <Star size={16} />}
      </span>
      <span className="timeline-activity__title">{activity.title}</span>
      {activity.text ? (
        <span className="timeline-activity__desc">{activity.text}</span>
      ) : null}
      {getEffectiveAnchored(activity) ? (
        <span className="timeline-activity__anchored-marker">
          {t('common:itinerary.presentation.anchoredMarker')}
        </span>
      ) : null}
    </li>
  )
}
