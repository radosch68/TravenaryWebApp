import type { ReactElement } from 'react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'

import type { ItineraryDay, ItineraryDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { groupActivitiesForPlanning, flattenSectionsToActivities } from '@/utils/activity-classification'
import { PlanningDaySection } from './PlanningDaySection'

interface ItineraryPlanningViewProps {
  itinerary: ItineraryDetail
  onReorder: (days: ItineraryDay[]) => void
  onToggleAnchored: (dayNumber: number, activityId: string, newValue: boolean) => void
  reorderError?: boolean
}

export function ItineraryPlanningView({ itinerary, onReorder, onToggleAnchored, reorderError }: ItineraryPlanningViewProps): ReactElement {
  const { t } = useTranslation(['common'])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 75, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Parse source: "flex-{dayNumber}-{blockIndex}"
    const activeMatch = activeId.match(/^flex-(\d+)-(\d+)$/)
    if (!activeMatch) return
    const sourceDayNum = Number(activeMatch[1])
    const sourceBlockIdx = Number(activeMatch[2])

    // Parse target: "slot-{dayNumber}-{position}"
    const slotMatch = overId.match(/^slot-(\d+)-(\d+)$/)
    if (!slotMatch) return
    const targetDayNum = Number(slotMatch[1])
    const targetPosition = Number(slotMatch[2])

    if (Number.isNaN(sourceDayNum) || Number.isNaN(targetDayNum) || Number.isNaN(targetPosition)) return

    const days = itinerary.days
    const sourceDay = days.find((d) => d.dayNumber === sourceDayNum)
    if (!sourceDay) return

    const sourceSections = groupActivitiesForPlanning(sourceDay.activities).sections
    const sourceSectionIdx = sourceSections.findIndex(
      (s) => s.type === 'flexible' && s.blockIndex === sourceBlockIdx,
    )
    if (sourceSectionIdx === -1) return
    const draggedSection = sourceSections[sourceSectionIdx]

    if (sourceDayNum === targetDayNum) {
      // Same-day reorder — skip if position hasn't actually changed
      if (targetPosition === sourceSectionIdx || targetPosition === sourceSectionIdx + 1) return

      const newSections = [...sourceSections]
      newSections.splice(sourceSectionIdx, 1)
      const adjustedPos = targetPosition > sourceSectionIdx ? targetPosition - 1 : targetPosition
      newSections.splice(adjustedPos, 0, draggedSection)

      const updatedDays = days.map((d) =>
        d.dayNumber === sourceDayNum
          ? { ...d, activities: flattenSectionsToActivities(newSections) }
          : d,
      )
      onReorder(updatedDays)
    } else {
      // Cross-day move
      const targetDay = days.find((d) => d.dayNumber === targetDayNum)
      if (!targetDay) return

      const newSourceSections = [...sourceSections]
      newSourceSections.splice(sourceSectionIdx, 1)

      const targetSections = [...groupActivitiesForPlanning(targetDay.activities).sections]
      targetSections.splice(targetPosition, 0, draggedSection)

      const updatedDays = days.map((d) => {
        if (d.dayNumber === sourceDayNum) return { ...d, activities: flattenSectionsToActivities(newSourceSections) }
        if (d.dayNumber === targetDayNum) return { ...d, activities: flattenSectionsToActivities(targetSections) }
        return d
      })
      onReorder(updatedDays)
    }
  }, [itinerary.days, onReorder])

  return (
    <div className="planning-view">
      <p className="planning-view__hint">{t('common:itinerary.dayEditor.editDayHint')}</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <ul className="itinerary-day-list">
          {itinerary.days.map((day, index) => (
            <DayRow
              key={day.dayNumber}
              day={day}
              index={index}
              itineraryId={itinerary.id}
              totalDays={itinerary.days.length}
              onToggleAnchored={onToggleAnchored}
            />
          ))}
        </ul>
      </DndContext>

      {reorderError && <p className="error">{t('common:itinerary.edit.saveFailed')}</p>}
    </div>
  )
}

/* ---- Day row (no longer a droppable — slots are inside PlanningDaySection) ---- */

interface DayRowProps {
  day: ItineraryDay
  index: number
  itineraryId: string
  totalDays: number
  onToggleAnchored: (dayNumber: number, activityId: string, newValue: boolean) => void
}

function DayRow({ day, index, itineraryId, totalDays, onToggleAnchored }: DayRowProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const navigate = useNavigate()
  const scrollStorageKey = `itinerary-detail-scroll:${itineraryId}`

  const navigateToDay = useCallback((): void => {
    try {
      window.sessionStorage.setItem(scrollStorageKey, String(window.scrollY))
    } catch {
      // Ignore storage errors and continue navigation.
    }

    navigate(`/itineraries/${itineraryId}/days/${day.dayNumber}`)
  }, [day.dayNumber, itineraryId, navigate, scrollStorageKey])

  const handleClick = useCallback((e: React.MouseEvent<HTMLLIElement>) => {
    // Let interactive children (buttons, drag handles) handle their own clicks
    const target = e.target as HTMLElement
    if (target.closest('button, [data-dnd-handle], .planning-section__grip')) return
    navigateToDay()
  }, [navigateToDay])

  return (
    <li
      className={`itinerary-day-list__item itinerary-day-list__item--${index % 2 === 0 ? 'odd' : 'even'}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
          return
        }

        const target = e.target as HTMLElement
        if (target.closest('button, [data-dnd-handle], .planning-section__grip')) {
          return
        }

        e.preventDefault()
        navigateToDay()
      }}
    >
      <div className="itinerary-day-header">
        <span className="itinerary-day-header__weekday">
          {day.date ? formatWeekday(day.date, i18n.language) : '—'}
        </span>
        <span className="itinerary-day-header__date" style={{ whiteSpace: 'nowrap' }}>
          {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
        </span>
        <span className="itinerary-day-header__index">
          {t('common:itinerary.dayNumber', { dayNumber: day.dayNumber })}
        </span>
      </div>
      {day.summary ? <p className="itinerary-day-summary">{day.summary}</p> : null}

      <PlanningDaySection
        day={day}
        dayIndex={index}
        totalDays={totalDays}
        onToggleAnchored={(activityId, newValue) => onToggleAnchored(day.dayNumber, activityId, newValue)}
      />
    </li>
  )
}
