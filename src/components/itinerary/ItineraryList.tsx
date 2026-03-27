import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItinerarySummary } from '@/services/contracts'
import { ItinerarySummaryCard } from '@/components/itinerary/ItinerarySummaryCard'

interface ItineraryListProps {
  items: ItinerarySummary[]
}

export function ItineraryList({ items }: ItineraryListProps): ReactElement {
  const { t } = useTranslation(['common'])

  return (
    <ul className="itinerary-list" aria-label={t('common:itinerary.listAriaLabel')}>
      {items.map((item) => (
        <ItinerarySummaryCard key={item.id} itinerary={item} />
      ))}
    </ul>
  )
}
