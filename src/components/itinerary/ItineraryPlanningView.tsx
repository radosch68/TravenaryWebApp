import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Moon, PencilSimple, Plus, X } from '@phosphor-icons/react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'

import { YesNoDialog } from '@/components/YesNoDialog'
import type { ItineraryActivity, ItineraryDay, ItineraryDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { groupActivitiesForPlanning, flattenSectionsToActivities } from '@/utils/activity-classification'
import { PlanningDaySection } from './PlanningDaySection'

interface ItineraryPlanningViewProps {
  itinerary: ItineraryDetail
  onReorder: (days: ItineraryDay[]) => void
  onInsertDay?: (dayNumber: number) => void
  onDeleteDay?: (dayNumber: number) => void
  referenceDisplayMode?: 'chips' | 'thumbnails'
  reorderError?: boolean
}

interface PendingAnchoredMove {
  updatedDays: ItineraryDay[]
  message: string
}

interface OvernightAccommodation {
  activity: ItineraryActivity
}

type OvernightCoverage =
  | { status: 'covered'; accommodation: OvernightAccommodation }
  | { status: 'missing' }
  | { status: 'multiple'; count: number }

export function ItineraryPlanningView({
  itinerary,
  onReorder,
  onInsertDay,
  onDeleteDay,
  referenceDisplayMode = 'chips',
  reorderError,
}: ItineraryPlanningViewProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const [pendingAnchoredMove, setPendingAnchoredMove] = useState<PendingAnchoredMove | null>(null)
  const overnightCoverageByGapDay = useMemo(() => getOvernightCoverageByGapDay(itinerary.days), [itinerary.days])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 75, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const applyCrossDayMove = useCallback((
    days: ItineraryDay[],
    sourceDayNum: number,
    sourceSections: ReturnType<typeof groupActivitiesForPlanning>['sections'],
    sourceSectionIdx: number,
    draggedSection: ReturnType<typeof groupActivitiesForPlanning>['sections'][number],
    targetDayNum: number,
    targetPosition: number,
  ): ItineraryDay[] | null => {
    const targetDay = days.find((d) => d.dayNumber === targetDayNum)
    if (!targetDay) return null

    const hasAnchored = draggedSection.activities.some((a) => a.anchorDate != null)
    const movedSection = hasAnchored && targetDay.date
      ? {
          ...draggedSection,
          activities: draggedSection.activities.map((a) =>
            a.anchorDate != null ? { ...a, anchorDate: targetDay.date! } : a,
          ),
        }
      : draggedSection

    const newSourceSections = [...sourceSections]
    newSourceSections.splice(sourceSectionIdx, 1)

    const targetSections = [...groupActivitiesForPlanning(targetDay.activities).sections]
    targetSections.splice(targetPosition, 0, movedSection)

    return days.map((d) => {
      if (d.dayNumber === sourceDayNum) return { ...d, activities: flattenSectionsToActivities(newSourceSections) }
      if (d.dayNumber === targetDayNum) return { ...d, activities: flattenSectionsToActivities(targetSections) }
      return d
    })
  }, [])

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
    const sourceSectionIdx = sourceSections.findIndex((s) => s.blockIndex === sourceBlockIdx)
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
      const hasAnchored = draggedSection.activities.some((a) => a.anchorDate != null)
      const updatedDays = applyCrossDayMove(
        days,
        sourceDayNum,
        sourceSections,
        sourceSectionIdx,
        draggedSection,
        targetDayNum,
        targetPosition,
      )
      if (!updatedDays) return

      if (hasAnchored) {
        const anchoredDates = Array.from(new Set(
          draggedSection.activities
            .map((activity) => activity.anchorDate)
            .filter((anchorDate): anchorDate is string => typeof anchorDate === 'string' && anchorDate.length > 0),
        ))

        const message = anchoredDates.length === 1
          ? t('common:itinerary.presentation.confirmAnchoredMoveWithDates', {
              sourceDate: formatLocalDate(anchoredDates[0], i18n.language),
              targetDate: formatLocalDate(itinerary.days.find((d) => d.dayNumber === targetDayNum)?.date ?? anchoredDates[0], i18n.language),
            })
          : t('common:itinerary.presentation.confirmAnchoredMove')

        setPendingAnchoredMove({ updatedDays, message })
        return
      }

      onReorder(updatedDays)
    }
  }, [applyCrossDayMove, i18n.language, itinerary.days, onReorder, t])

  const handleConfirmAnchoredMove = useCallback((): void => {
    if (!pendingAnchoredMove) return
    onReorder(pendingAnchoredMove.updatedDays)
    setPendingAnchoredMove(null)
  }, [onReorder, pendingAnchoredMove])

  const handleCancelAnchoredMove = useCallback((): void => {
    setPendingAnchoredMove(null)
  }, [])

  return (
    <>
      <div className="planning-view">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <ul className="itinerary-day-list">
            {itinerary.days.map((day, index) => (
              <Fragment key={`planning-day-${day.dayNumber}`}>
                {onInsertDay ? (
                  <DayInsertSlot
                    dayNumber={day.dayNumber}
                    onInsertDay={onInsertDay}
                    overnightCoverage={index > 0 ? overnightCoverageByGapDay.get(day.dayNumber - 1) ?? { status: 'missing' } : undefined}
                  />
                ) : null}
                <DayRow
                  day={day}
                  index={index}
                  itineraryId={itinerary.id}
                  totalDays={itinerary.days.length}
                  onDeleteDay={onDeleteDay}
                  referenceDisplayMode={referenceDisplayMode}
                />
              </Fragment>
            ))}
            {onInsertDay ? (
              <DayInsertSlot dayNumber={itinerary.days.length + 1} onInsertDay={onInsertDay} />
            ) : null}
          </ul>
        </DndContext>

        {reorderError && <p className="error">{t('common:itinerary.edit.saveFailed')}</p>}
      </div>

      {pendingAnchoredMove ? (
        <YesNoDialog
          title={t('common:itinerary.presentation.confirmAnchoredMoveTitle')}
          message={pendingAnchoredMove.message}
          confirmLabel={t('common:itinerary.presentation.confirmAnchoredMoveAccept')}
          cancelLabel={t('common:itinerary.presentation.confirmAnchoredMoveCancel')}
          onConfirm={handleConfirmAnchoredMove}
          onCancel={handleCancelAnchoredMove}
        />
      ) : null}
    </>
  )
}

function getOvernightCoverageByGapDay(days: ItineraryDay[]): Map<number, OvernightCoverage> {
  const coverage = new Map<number, OvernightAccommodation[]>()

  days.forEach((day) => {
    day.activities.forEach((activity) => {
      if (activity.type !== 'accommodation') {
        return
      }

      const nights = Math.floor(activity.details?.nights ?? 0)
      if (nights < 1) {
        return
      }

      for (let offset = 0; offset < nights; offset += 1) {
        const gapDayNumber = day.dayNumber + offset
        const items = coverage.get(gapDayNumber) ?? []
        items.push({ activity })
        coverage.set(gapDayNumber, items)
      }
    })
  })

  return new Map<number, OvernightCoverage>(
    days.slice(0, -1).map((day): [number, OvernightCoverage] => {
      const accommodations = coverage.get(day.dayNumber) ?? []

      if (accommodations.length === 1) {
        return [day.dayNumber, { status: 'covered', accommodation: accommodations[0] }]
      }

      if (accommodations.length > 1) {
        return [day.dayNumber, { status: 'multiple', count: accommodations.length }]
      }

      return [day.dayNumber, { status: 'missing' }]
    }),
  )
}

/* ---- Day row (no longer a droppable — slots are inside PlanningDaySection) ---- */

interface DayRowProps {
  day: ItineraryDay
  index: number
  itineraryId: string
  totalDays: number
  onDeleteDay?: (dayNumber: number) => void
  referenceDisplayMode: 'chips' | 'thumbnails'
}

function DayRow({
  day,
  index,
  itineraryId,
  totalDays,
  onDeleteDay,
  referenceDisplayMode,
}: DayRowProps): ReactElement {
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

  return (
    <li
      className={`itinerary-day-list__item itinerary-day-list__item--${index % 2 === 0 ? 'odd' : 'even'}`}
    >
      <div
        className="itinerary-day-header"
        role="button"
        tabIndex={0}
        onClick={navigateToDay}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigateToDay()
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
          <button
            type="button"
            className="itinerary-day-header__icon-button"
            onClick={(e) => {
              e.stopPropagation()
              navigateToDay()
            }}
            aria-label={t('common:itinerary.days.editDay')}
            title={t('common:itinerary.days.editDay')}
          >
            <PencilSimple size={16} weight="bold" />
          </button>
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
      {day.summary ? <p className="itinerary-day-summary">{day.summary}</p> : null}

      <PlanningDaySection
        day={day}
        dayIndex={index}
        totalDays={totalDays}
        referenceDisplayMode={referenceDisplayMode}
      />
    </li>
  )
}

function DayInsertSlot({
  dayNumber,
  onInsertDay,
  overnightCoverage,
}: {
  dayNumber: number
  onInsertDay: (dayNumber: number) => void
  overnightCoverage?: OvernightCoverage
}): ReactElement {
  const { t } = useTranslation(['common'])

  const handleAccommodationClick = useCallback((): void => {
    if (overnightCoverage?.status !== 'covered') {
      return
    }

    document
      .getElementById(getPlanningActivityElementId(overnightCoverage.accommodation.activity.id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [overnightCoverage])

  return (
    <li className={`itinerary-day-insert-slot${overnightCoverage ? ' itinerary-day-insert-slot--overnight' : ''}`}>
      {overnightCoverage ? (
        <OvernightCoverageBand
          coverage={overnightCoverage}
          onClick={overnightCoverage.status === 'covered' ? handleAccommodationClick : undefined}
        />
      ) : null}
      <button
        type="button"
        className="itinerary-day-insert-button itinerary-day-header__icon-button"
        onClick={() => onInsertDay(dayNumber)}
        aria-label={t('common:itinerary.days.insertDayAt', { dayNumber })}
        title={t('common:itinerary.days.insertDayAt', { dayNumber })}
      >
        <Plus size={16} weight="bold" />
      </button>
    </li>
  )
}

function OvernightCoverageBand({
  coverage,
  onClick,
}: {
  coverage: OvernightCoverage
  onClick?: () => void
}): ReactElement {
  const { t } = useTranslation(['common'])
  const label = coverage.status === 'covered'
    ? coverage.accommodation.activity.title
    : coverage.status === 'multiple'
      ? t('common:itinerary.presentation.overnightMultiple')
      : t('common:itinerary.presentation.overnightMissing')
  const className = `overnight-coverage overnight-coverage--${coverage.status}${onClick ? ' overnight-coverage--clickable' : ''}`
  const content = (
    <>
      <Moon size={15} weight="fill" className="overnight-coverage__icon" />
      <span className="overnight-coverage__label">{label}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={t('common:itinerary.presentation.overnightScrollToAccommodation', { title: label })}
        title={t('common:itinerary.presentation.overnightScrollToAccommodation', { title: label })}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} aria-label={label} title={label}>
      {content}
    </div>
  )
}

function getPlanningActivityElementId(activityId: string): string {
  return `planning-activity-${activityId}`
}
