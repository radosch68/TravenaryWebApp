import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable, useDroppable } from '@dnd-kit/core'

import { Star } from '@phosphor-icons/react'

import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'
import { groupActivitiesForPlanning } from '@/utils/activity-classification'
import { formatLocalTimeRange } from '@/utils/date-format'
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_COLOR } from './activity-presentation'
import { AnchoredStatusToggle } from './AnchoredStatusToggle'

interface PlanningDaySectionProps {
  day: ItineraryDay
  onToggleAnchored: (activityId: string, newValue: boolean) => void
  disabled?: boolean
  totalDays: number
  dayIndex: number
}

export function PlanningDaySection({ day, onToggleAnchored, disabled, totalDays, dayIndex }: PlanningDaySectionProps): ReactElement {
  const { t } = useTranslation(['common'])
  const { sections, flexibleBlockCount } = groupActivitiesForPlanning(day.activities)

  if (day.activities.length === 0) {
    return (
      <div className="planning-day-section">
        <DropSlot dayNumber={day.dayNumber} position={0} />
        <p className="itinerary-day-activities__empty">{t('common:itinerary.days.noActivities')}</p>
      </div>
    )
  }

  return (
    <div className="planning-day-section">
      <DropSlot dayNumber={day.dayNumber} position={0} />
      {sections.map((section, sIdx) => (
        <Fragment key={section.type === 'anchored' ? `a-${sIdx}` : `f-${section.blockIndex}`}>
          {section.type === 'anchored' ? (
            <div className="planning-section planning-section--anchored">
              <ul className="planning-section__list">
                {section.activities.map((activity) => (
                  <PlanningActivityRow
                    key={activity.id}
                    activity={activity}
                    onToggleAnchored={onToggleAnchored}
                    disabled={disabled}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <FlexibleBlock
              dayNumber={day.dayNumber}
              dayIndex={dayIndex}
              totalDays={totalDays}
              blockIndex={section.blockIndex}
              blockCount={flexibleBlockCount}
              dividerLabel={section.dividerLabel}
              activities={section.activities}
              onToggleAnchored={onToggleAnchored}
              disabled={disabled}
            />
          )}
          <DropSlot dayNumber={day.dayNumber} position={sIdx + 1} />
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
  onToggleAnchored: (activityId: string, newValue: boolean) => void
  disabled?: boolean
}

function FlexibleBlock({ dayNumber, totalDays, blockIndex, blockCount, dividerLabel, activities, onToggleAnchored, disabled }: FlexibleBlockProps): ReactElement {
  const isSingleDay = totalDays <= 1
  const isSingleBlock = isSingleDay && blockCount <= 1

  const { setNodeRef, transform, isDragging, listeners, attributes } = useDraggable({
    id: `flex-${dayNumber}-${blockIndex}`,
    disabled: isSingleBlock,
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`planning-section planning-section--flexible${isDragging ? ' planning-section--dragging' : ''}`}
    >
      <div className="planning-section__divider-label">
        {!isSingleBlock && (
          <span
            className="planning-section__grip"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            {...listeners}
            {...attributes}
          >
            <GripIcon />
          </span>
        )}
        {dividerLabel && <span className="planning-section__divider-text">{dividerLabel}</span>}
        <span className="planning-section__divider-line" />
        {!isSingleBlock && (
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
            onToggleAnchored={onToggleAnchored}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  )
}

/* ---- Activity row ---- */

interface PlanningActivityRowProps {
  activity: ItineraryActivity
  onToggleAnchored: (activityId: string, newValue: boolean) => void
  disabled?: boolean
}

function PlanningActivityRow({ activity, onToggleAnchored, disabled }: PlanningActivityRowProps): ReactElement {
  const { i18n } = useTranslation(['common'])
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note

  return (
    <li
      className="planning-activity"
      style={{
        background: typeColor.bg,
        border: `2px solid ${typeColor.icon}50`,
      }}
    >
      <AnchoredStatusToggle
        isAnchored={activity.isAnchored}
        onToggle={(v) => onToggleAnchored(activity.id, v)}
        disabled={disabled}
      />
      <span className="planning-activity__type-icon" style={{ color: typeColor.icon }}>
        {ACTIVITY_TYPE_ICON[activity.type] ?? <Star size={16} />}
      </span>
      <span className="planning-activity__title">{activity.title}</span>
      {activity.time ? (
        <span className="planning-activity__time">
          {formatLocalTimeRange(activity.time, activity.timeEnd, i18n.language)}
        </span>
      ) : null}
      {activity.text ? (
        <span className="planning-activity__desc">{activity.text}</span>
      ) : null}
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
