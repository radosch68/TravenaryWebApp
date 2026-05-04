import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItineraryActivity } from '@/services/contracts'

interface ItineraryActivityBenchSummaryProps {
  activityBench: ItineraryActivity[]
}

export function ItineraryActivityBenchSummary({
  activityBench,
}: ItineraryActivityBenchSummaryProps): ReactElement | null {
  const { t } = useTranslation(['common'])

  if (activityBench.length === 0) {
    return null
  }

  return (
    <details className="itinerary-detail-bench-summary">
      <summary>
        {t('common:itinerary.activityBench.summary', { count: activityBench.length })}
      </summary>
      <ul>
        {activityBench.map((activity) => (
          <li key={activity.id}>{activity.title}</li>
        ))}
      </ul>
    </details>
  )
}
