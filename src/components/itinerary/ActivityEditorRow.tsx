import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '@dnd-kit/core'
import { Trash } from '@phosphor-icons/react'

import type { ItineraryActivity } from '@/services/contracts'
import { ACTIVITY_TYPE_COLOR } from './activity-presentation'
import { ActivityCardContent } from './ActivityCardContent'

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
  const { t } = useTranslation(['common'])

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLLIElement>): void => {
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
    data: { activityId: activity.id, sourceBlockKey: blockKey, sourceSurface: 'day' as const },
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
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onEdit()
        }
      }}
      onKeyDown={handleEditKeyDown}
    >
      <ActivityCardContent
        activity={activity}
        referenceDisplayMode="thumbnails"
        headerLeading={(
          <span
            className="activity-editor-row__drag-handle"
            onClick={(event) => event.stopPropagation()}
            {...listeners}
            {...attributes}
          >
            <GripIcon />
          </span>
        )}
        headerAction={(
          <button
            type="button"
            className="activity-editor-row__delete-btn"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            disabled={disabled}
            aria-label={t('common:itinerary.dayEditor.deleteActivity')}
          >
            <Trash size={16} />
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
