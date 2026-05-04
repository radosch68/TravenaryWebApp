import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Plus, X } from '@phosphor-icons/react'

import type { ItineraryDetail, SharedItineraryDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { PlanningDaySection } from './PlanningDaySection'
import { TimelineDaySection } from './TimelineDaySection'

type TimelineContentMode = 'timeline' | 'planning-blocks'

interface ItineraryTimelineViewProps {
  itinerary: ItineraryDetail | SharedItineraryDetail
  onOpenDay?: (dayNumber: number) => void
  onInsertDay?: (dayNumber: number) => void
  onDeleteDay?: (dayNumber: number) => void
  referenceDisplayMode?: 'chips' | 'thumbnails'
  contentMode?: TimelineContentMode
}

export function ItineraryTimelineView({
  itinerary,
  onOpenDay,
  onInsertDay,
  onDeleteDay,
  referenceDisplayMode = 'chips',
  contentMode = 'timeline',
}: ItineraryTimelineViewProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])

  return (
    <ul className="itinerary-day-list itinerary-day-list--timeline">
      {itinerary.days.map((day, index) => (
        <Fragment key={`timeline-day-${day.dayNumber}`}>
          {onInsertDay ? (
            <li className="itinerary-day-insert-slot">
              <button
                type="button"
                className="itinerary-day-insert-button itinerary-day-header__icon-button"
                onClick={() => onInsertDay(day.dayNumber)}
                aria-label={t('common:itinerary.days.insertDayAt', { dayNumber: day.dayNumber })}
                title={t('common:itinerary.days.insertDayAt', { dayNumber: day.dayNumber })}
              >
                <Plus size={16} weight="bold" />
              </button>
            </li>
          ) : null}
          <li
            className={`itinerary-day-list__item itinerary-day-list__item--${index % 2 === 0 ? 'odd' : 'even'}`}
          >
            <div
              className="itinerary-day-header"
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay && onOpenDay(day.dayNumber)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onOpenDay) {
                  e.preventDefault()
                  onOpenDay(day.dayNumber)
                }
              }}
            >
              <div className="itinerary-day-header__left">
                <span className="itinerary-day-header__weekday">
                  {day.date ? formatWeekday(day.date, i18n.language) : '—'}
                </span>
                <span className="itinerary-day-header__index">
                  {t('common:itinerary.dayNumber', { dayNumber: day.dayNumber })}
                </span>
              </div>
              <span className="itinerary-day-header__date">
                {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
              </span>
              <div className="itinerary-day-header__actions">
                {onOpenDay ? (
                  <button
                    type="button"
                    className="itinerary-day-header__icon-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDay(day.dayNumber)
                    }}
                    aria-label={t('common:itinerary.days.openDetail')}
                    title={t('common:itinerary.days.openDetail')}
                  >
                    <Eye size={16} weight="bold" />
                  </button>
                ) : null}
                {onDeleteDay ? (
                  <button
                    type="button"
                    className="itinerary-day-header__icon-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteDay(day.dayNumber)
                    }}
                    aria-label={t('common:itinerary.days.deleteDay')}
                    title={t('common:itinerary.days.deleteDay')}
                  >
                    <X size={16} weight="bold" />
                  </button>
                ) : null}
              </div>
            </div>
            {day.summary ? <p>{day.summary}</p> : null}

            {contentMode === 'planning-blocks' ? (
              <PlanningDaySection
                day={day}
                dayIndex={index}
                totalDays={itinerary.days.length}
                disabled
                showDropSlots={false}
                referenceDisplayMode={referenceDisplayMode}
              />
            ) : (
              <TimelineDaySection
                activities={day.activities}
                referenceDisplayMode={referenceDisplayMode}
              />
            )}
          </li>
        </Fragment>
      ))}
      {onInsertDay ? (
        <li className="itinerary-day-insert-slot">
          <button
            type="button"
            className="itinerary-day-insert-button itinerary-day-header__icon-button"
            onClick={() => onInsertDay(itinerary.days.length + 1)}
            aria-label={t('common:itinerary.days.insertDayAt', { dayNumber: itinerary.days.length + 1 })}
            title={t('common:itinerary.days.insertDayAt', { dayNumber: itinerary.days.length + 1 })}
          >
            <Plus size={16} weight="bold" />
          </button>
        </li>
      ) : null}
    </ul>
  )
}
