import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable, useDroppable } from '@dnd-kit/core'

import { AnchorSimple } from '@phosphor-icons/react'

import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'
import { groupActivitiesForPlanning, isActivityAnchored } from '@/utils/activity-classification'
import { ACTIVITY_TYPE_COLOR } from './activity-presentation'
import { ActivityCardContent } from './ActivityCardContent'

interface PlanningDaySectionProps {
  day: ItineraryDay
  disabled?: boolean
  showDropSlots?: boolean
  totalDays: number
  dayIndex: number
  referenceDisplayMode?: 'chips' | 'thumbnails'
}

export function PlanningDaySection({
  day,
  disabled,
  showDropSlots = true,
  totalDays,
  dayIndex,
  referenceDisplayMode = 'chips',
}: PlanningDaySectionProps): ReactElement {
  const { t } = useTranslation(['common'])
  const { sections, blockCount } = groupActivitiesForPlanning(day.activities)

  if (day.activities.length === 0) {
    return (
      <div className="planning-day-section">
        {showDropSlots ? <DropSlot dayNumber={day.dayNumber} position={0} /> : null}
        <p className="itinerary-day-activities__empty">{t('common:itinerary.days.noActivities')}</p>
      </div>
    )
  }

  return (
    <div className="planning-day-section">
      {showDropSlots ? <DropSlot dayNumber={day.dayNumber} position={0} /> : null}
      {sections.map((section, sIdx) => (
        <Fragment key={`f-${section.blockIndex}`}>
          <FlexibleBlock
            dayNumber={day.dayNumber}
            dayIndex={dayIndex}
            totalDays={totalDays}
            blockIndex={section.blockIndex}
            blockCount={blockCount}
            dividerLabel={section.dividerLabel}
            activities={section.activities}
            disabled={disabled}
            referenceDisplayMode={referenceDisplayMode}
          />
          {showDropSlots ? <DropSlot dayNumber={day.dayNumber} position={sIdx + 1} /> : null}
        </Fragment>
      ))}
    </div>
  )
}

/* ---- Drop slot between sections ---- */

function DropSlot({ dayNumber, position }: { dayNumber: number; position: number }): ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayNumber}-${position}` })
  return (
    <div
      ref={setNodeRef}
      className={`drop-slot${isOver ? ' drop-slot--active' : ''}`}
    />
  )
}

/* ---- Draggable flexible block ---- */

interface FlexibleBlockProps {
  dayNumber: number
  dayIndex: number
  totalDays: number
  blockIndex: number
  blockCount: number
  dividerLabel?: string
  activities: ItineraryActivity[]
  disabled?: boolean
  referenceDisplayMode?: 'chips' | 'thumbnails'
}

function FlexibleBlock({
  dayNumber,
  totalDays,
  blockIndex,
  blockCount,
  dividerLabel,
  activities,
  disabled,
  referenceDisplayMode = 'chips',
}: FlexibleBlockProps): ReactElement {
  const { t } = useTranslation(['common'])
  const isSingleDay = totalDays <= 1
  const isSingleBlock = isSingleDay && blockCount <= 1
  const isDraggable = !disabled && !isSingleBlock
  const hasAnchoredActivities = activities.some((activity) => isActivityAnchored(activity))
  const visibleLabel = dividerLabel

  const { setNodeRef, transform, isDragging, listeners, attributes } = useDraggable({
    id: `flex-${dayNumber}-${blockIndex}`,
    disabled: !isDraggable,
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`planning-section ${hasAnchoredActivities ? 'planning-section--anchored' : 'planning-section--flexible'}${isDragging ? ' planning-section--dragging' : ''}`}
    >
      {hasAnchoredActivities && (
        <span
          className="planning-section__anchor-marker"
          aria-label={t('common:itinerary.presentation.anchored')}
          title={t('common:itinerary.presentation.anchored')}
        >
          <AnchorSimple size={12} weight="bold" />
        </span>
      )}
      <div className="planning-section__divider-label">
        {isDraggable && (
          <span
            className="planning-section__grip"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            {...listeners}
            {...attributes}
          >
            <GripIcon />
          </span>
        )}
        {visibleLabel && <span className="planning-section__divider-text">{visibleLabel}</span>}
        <span className="planning-section__divider-line" />
        {isDraggable && (
          <span
            className="planning-section__grip"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            {...listeners}
            {...attributes}
          >
            <GripIcon />
          </span>
        )}
      </div>
      <ul className="planning-section__list">
        {activities.map((activity) => (
          <PlanningActivityRow
            key={activity.id}
            activity={activity}
            disabled={disabled}
            referenceDisplayMode={referenceDisplayMode}
          />
        ))}
      </ul>
    </div>
  )
}

/* ---- Activity row ---- */

interface PlanningActivityRowProps {
  activity: ItineraryActivity
  disabled?: boolean
  referenceDisplayMode?: 'chips' | 'thumbnails'
}

function PlanningActivityRow({
  activity,
  referenceDisplayMode = 'chips',
}: PlanningActivityRowProps): ReactElement {
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note
  const anchored = isActivityAnchored(activity)

  return (
    <li
      id={`planning-activity-${activity.id}`}
      className={`planning-activity${anchored ? ' planning-activity--anchored' : ''}`}
      style={{
        background: typeColor.bg,
        border: `1px solid ${typeColor.icon}1A`,
      }}
    >
      <ActivityCardContent
        activity={activity}
        headerLayout="inline"
        className="planning-activity__content"
        referenceDisplayMode={referenceDisplayMode}
      />
    </li>
  )
}

/* ---- Compact grip icon (2×3 dots) ---- */

function GripIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="14"
      viewBox="0 0 16 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="2" cy="2" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="6" cy="2" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="10" cy="2" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="14" cy="2" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="2" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="6" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="10" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="14" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="2" cy="12" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="6" cy="12" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="10" cy="12" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="14" cy="12" r="1.2" fill="currentColor" fillOpacity="0.5" />
    </svg>
  )
}
