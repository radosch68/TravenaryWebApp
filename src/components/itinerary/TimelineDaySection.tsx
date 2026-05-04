import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItineraryActivity } from '@/services/contracts'
import { getEffectiveAnchored, sortActivitiesForTimeline } from '@/utils/activity-classification'
import { ACTIVITY_TYPE_COLOR } from './activity-presentation'
import { ActivityCardContent } from './ActivityCardContent'

interface TimelineDaySectionProps {
  activities: ItineraryActivity[]
  referenceDisplayMode?: 'chips' | 'thumbnails'
}

export function TimelineDaySection({
  activities,
  referenceDisplayMode = 'chips',
}: TimelineDaySectionProps): ReactElement {
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
          <TimelineActivityRow
            key={activity.id}
            activity={activity}
            t={t}
            referenceDisplayMode={referenceDisplayMode}
          />
        ))}
      </ul>
    </div>
  )
}

function TimelineActivityRow({
  activity,
  t,
  referenceDisplayMode = 'chips',
}: {
  activity: ItineraryActivity
  t: (key: string) => string
  referenceDisplayMode?: 'chips' | 'thumbnails'
}): ReactElement {
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note
  const anchoredMarker = getEffectiveAnchored(activity) ? (
    <span className="timeline-activity__anchored-marker">
      {t('common:itinerary.presentation.anchoredMarker')}
    </span>
  ) : null

  return (
    <li
      className="timeline-activity"
      style={{
        background: typeColor.bg,
        border: `1px solid ${typeColor.icon}1A`,
      }}
    >
      <ActivityCardContent
        activity={activity}
        headerLayout="inline"
        className="timeline-activity__content"
        referenceDisplayMode={referenceDisplayMode}
        anchoredMarker={anchoredMarker}
      />
    </li>
  )
}
