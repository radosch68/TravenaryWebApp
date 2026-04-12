import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '@dnd-kit/core'
import { Star, Trash } from '@phosphor-icons/react'

import type { ItineraryActivity } from '@/services/contracts'
import { formatLocalTimeRange } from '@/utils/date-format'
import { ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_ICON } from './activity-presentation'

interface ActivityEditorRowProps {
  activity: ItineraryActivity
  isAnchored: boolean
  blockKey: string
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
  dragDisabled?: boolean
}

export function ActivityEditorRow({
  activity,
  isAnchored,
  blockKey,
  onEdit,
  onDelete,
  disabled,
  dragDisabled,
}: ActivityEditorRowProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      onEdit()
      return
    }

    if (e.key === ' ') {
      e.preventDefault()
      onEdit()
    }
  }

  const { setNodeRef, transform, isDragging, listeners, attributes } = useDraggable({
    id: `activity-${activity.id}`,
    data: { activityId: activity.id, sourceBlockKey: blockKey },
    disabled: dragDisabled || disabled,
  })

  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    background: typeColor.bg,
    border: `2px solid ${typeColor.icon}26`,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`activity-editor-row${isAnchored ? ' activity-editor-row--anchored' : ''}${isDragging ? ' activity-editor-row--dragging' : ''}`}
    >
      <div className="activity-editor-row__left">
        <span
          className="activity-editor-row__drag-handle"
          {...listeners}
          {...attributes}
        >
          <GripIcon />
        </span>
        <span className="activity-editor-row__type-icon" aria-label={activity.type} style={{ color: typeColor.icon }}>
          {ACTIVITY_TYPE_ICON[activity.type] ?? <Star size={18} />}
        </span>
      </div>

      <div
        className="activity-editor-row__header"
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={handleEditKeyDown}
      >
        <span className="activity-editor-row__title">{activity.title}</span>
        {activity.time && (
          <span className="activity-editor-row__time">
            {formatLocalTimeRange(activity.time, activity.timeEnd, i18n.language)}
          </span>
        )}
      </div>

      <div
        className="activity-editor-row__description-wrap"
        onClick={onEdit}
      >
        {activity.text ? (
          <span className="activity-editor-row__description">{activity.text}</span>
        ) : null}
      </div>

      <div className="activity-editor-row__right">
        <button
          type="button"
          className="activity-editor-row__delete-btn"
          onClick={onDelete}
          disabled={disabled}
          aria-label={t('common:itinerary.dayEditor.deleteActivity')}
        >
          <Trash size={16} />
        </button>
      </div>
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
