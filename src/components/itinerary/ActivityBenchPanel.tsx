import type { CSSProperties, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CaretCircleDoubleUp } from '@phosphor-icons/react'

import type { ActivityType, ItineraryActivity } from '@/services/contracts'
import benchManImage from '@/assets/bench-man-192.png'
import { groupActivityBenchByType } from '@/utils/activity-bench'
import { ACTIVITY_TYPE_COLOR } from './activity-presentation'
import { ActivityCardContent } from './ActivityCardContent'

const ACTIVITY_TYPE_LABEL_KEY: Record<Exclude<ActivityType, 'divider'>, string> = {
  note: 'note',
  flight: 'flight',
  transfer: 'transfer',
  poi: 'poi',
  custom: 'custom',
  carRental: 'carRental',
  food: 'food',
  shopping: 'shopping',
  tour: 'tour',
  accommodation: 'accommodation',
}

interface ActivityBenchPanelProps {
  activityBench: ItineraryActivity[]
  onMoveToCurrentDay: (activityId: string) => void
  disabled?: boolean
}

export function ActivityBenchPanel({
  activityBench,
  onMoveToCurrentDay,
  disabled,
}: ActivityBenchPanelProps): ReactElement {
  const { t } = useTranslation(['common'])
  const groups = groupActivityBenchByType(activityBench)
  const { setNodeRef, isOver } = useDroppable({
    id: 'activity-bench-dropzone',
    data: { targetSurface: 'bench' as const },
    disabled,
  })

  return (
    <section
      ref={setNodeRef}
      className={`activity-bench-panel${isOver ? ' activity-bench-panel--drop-active' : ''}`}
      aria-label={t('common:itinerary.dayEditor.activityBench.title')}
    >
      <header className="activity-bench-panel__header">
        <div className="activity-bench-panel__header-copy">
          <h2>{t('common:itinerary.dayEditor.activityBench.title')}</h2>
          <span className="activity-bench-panel__count">
            {t('common:itinerary.days.activityCount', { count: activityBench.length })}
          </span>
        </div>
        <img
          src={benchManImage}
          alt=""
          aria-hidden="true"
          className="activity-bench-panel__decor"
        />
      </header>

      {groups.length === 0 ? (
        <p className="activity-bench-panel__empty">{t('common:itinerary.dayEditor.activityBench.empty')}</p>
      ) : (
        <div className="activity-bench-panel__groups">
          {groups.map((group) => (
            <section key={group.type} className="activity-bench-group">
              <header className="activity-bench-group__header">
                <span>{t(`common:itinerary.dayEditor.activityTypeOptions.${ACTIVITY_TYPE_LABEL_KEY[group.type]}`)}</span>
                <span>{t('common:itinerary.days.activityCount', { count: group.activities.length })}</span>
              </header>

              <ul className="activity-bench-group__list">
                {group.activities.map((activity) => (
                  <BenchActivityRow
                    key={activity.id}
                    activity={activity}
                    onMoveToCurrentDay={onMoveToCurrentDay}
                    disabled={disabled}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

interface BenchActivityRowProps {
  activity: ItineraryActivity
  onMoveToCurrentDay: (activityId: string) => void
  disabled?: boolean
}

function BenchActivityRow({ activity, onMoveToCurrentDay, disabled }: BenchActivityRowProps): ReactElement {
  const { t } = useTranslation(['common'])
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note
  const { setNodeRef, transform, isDragging, listeners, attributes } = useDraggable({
    id: `bench-activity-${activity.id}`,
    data: { activityId: activity.id, sourceSurface: 'bench' as const },
    disabled,
  })

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    background: typeColor.bg,
    border: `2px solid ${typeColor.icon}26`,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`activity-editor-row activity-editor-row--bench${isDragging ? ' activity-editor-row--dragging' : ''}`}
    >
      <ActivityCardContent
        activity={activity}
        referenceDisplayMode="thumbnails"
        headerLeading={(
          <span className="activity-editor-row__drag-handle" {...listeners} {...attributes} aria-hidden="true">
            <GripIcon />
          </span>
        )}
        headerAction={(
          <button
            type="button"
            className="activity-editor-row__move-btn"
            onClick={() => onMoveToCurrentDay(activity.id)}
            disabled={disabled}
            title={t('common:itinerary.dayEditor.activityBench.moveToCurrentDay')}
            aria-label={t('common:itinerary.dayEditor.activityBench.moveToCurrentDay')}
          >
            <CaretCircleDoubleUp size={20} />
          </button>
        )}
      />
    </li>
  )
}

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
