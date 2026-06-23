/* eslint-disable react-refresh/only-export-components */
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import {
  Anchor,
  Camera,
  CircleAlert,
  ExternalLink,
  Film,
  Info,
  Link2,
  MapPin,
  MapPinned,
  Route,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  AccommodationPlatform,
  ActivityLocation,
  ActivityType,
  FlightAirport,
  ItineraryActivity,
  TransferMot,
  WebReference,
} from '@/services/contracts'
import { ACTIVITY_TYPE_ICON } from '@/components/itinerary/activity-presentation'
import {
  SPAN_ACTIVITY_CONFIGS,
  type ActivityFooterItem,
  type ActivityFooterSeverity,
} from '@/components/itinerary/span-activity'
import { ACTIVITY_VALIDATION_MESSAGE_KEYS } from '@/components/itinerary/activity-validation'
import { DialogShell } from '@/components/common/DialogShell'
import { ActivityFormPanel } from '@/components/itinerary/ActivityFormPanel'
import { hasCoordinates } from '@/components/itinerary/location-map-pins'
import { formatLocalTime } from '@/utils/date-format'
import { getReferenceThumbnailUrl, toReferenceChipType } from '@/utils/reference-url'

import styles from '@/tiptap/activity-tile-extension.module.css'

export type ActivityTileAttributes = {
  activity?: ItineraryActivity
}

export interface ActivityTileLabels {
  locale: string
  activityEditorLabel: string
  deleteActivity: string
  deleteDialog: {
    title: string
    message: string
    bench: string
    delete: string
    benchBlockedAnchored: string
  }
  cancelEdit: string
  confirmEdit: string
  titleFallback: string
  fields: {
    title: string
    time: string
    notes: string
  }
  display: {
    anchored: string
    nights: (count: number) => string
    guidanceGuided: string
    guidanceSelfGuided: string
    cuisineLabel: (cuisine: string) => string
    transferRouteFrom: string
    transferRouteTo: string
    transferMotLabel: string
    transferMotOptions: Record<TransferMot, string>
    transferEstimateLabel: string
    transferEstimateUnavailable: string
    transferEstimatePending: string
    accommodationSummaryNights: string
    accommodationSummaryCheckIn: string
    accommodationSummaryCheckOut: string
    accommodationSummaryEmpty: string
    accommodationFieldGuests: string
    accommodationFieldPlatform: string
    accommodationFieldContactPhone: string
    accommodationFieldContactEmail: string
    accommodationFieldBookingRef: string
    flightNumber: string
    flightDeparture: string
    flightArrival: string
    flightDuration: string
    platformOptions: Record<AccommodationPlatform, string>
    locationFallback: string
    openReferenceAria: (label: string) => string
    openMapAria: (label: string) => string
    // Footer warning text per span-activity type, shown when the span runs past
    // the itinerary's last day. Keyed by activity type so future span types need
    // no change here.
    footerSpanBeyondItinerary: Partial<Record<ActivityType, string>>
    // Localized validation messages keyed by i18n key, for rendering validator
    // issues (errors/warnings) in the tile footer.
    validationMessages: Record<string, string>
  }
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string

/**
 * Single source of truth for the activity-tile label bundle, shared by the
 * editor (which feeds it into the NodeView, outside the i18n provider) and the
 * read-only tile renderer.
 */
export function buildActivityTileLabels(t: TranslateFn, locale: string): ActivityTileLabels {
  return {
    locale,
    activityEditorLabel: t('itineraryView.richEditor.activityEditorLabel'),
    deleteActivity: t('itineraryView.richEditor.deleteActivity'),
    deleteDialog: {
      title: t('itineraryView.richEditor.deleteDialog.title'),
      message: t('itineraryView.richEditor.deleteDialog.message'),
      bench: t('itineraryView.richEditor.deleteDialog.bench'),
      delete: t('itineraryView.richEditor.deleteDialog.delete'),
      benchBlockedAnchored: t('itineraryView.richEditor.deleteDialog.benchBlockedAnchored'),
    },
    cancelEdit: t('cancel'),
    confirmEdit: t('save'),
    titleFallback: t('itineraryView.richEditor.titleFallback'),
    fields: {
      title: t('itineraryView.richEditor.fields.title'),
      time: t('itineraryView.richEditor.fields.time'),
      notes: t('itineraryView.richEditor.fields.notes'),
    },
    display: {
      anchored: t('itineraryView.anchored'),
      nights: (count) => t('itineraryView.nights', { count }),
      guidanceGuided: t('itineraryView.guidanceGuided'),
      guidanceSelfGuided: t('itineraryView.guidanceSelfGuided'),
      cuisineLabel: (cuisine) => t('itineraryView.cuisineLabel', { cuisine }),
      transferRouteFrom: t('itineraryView.transferRouteFrom'),
      transferRouteTo: t('itineraryView.transferRouteTo'),
      transferMotLabel: t('itineraryView.transferMotLabel'),
      transferMotOptions: {
        walk: t('itineraryView.transferMot.walk'),
        bike: t('itineraryView.transferMot.bike'),
        motorcycle: t('itineraryView.transferMot.motorcycle'),
        car: t('itineraryView.transferMot.car'),
        bus: t('itineraryView.transferMot.bus'),
        train: t('itineraryView.transferMot.train'),
      },
      transferEstimateLabel: t('itineraryView.transferEstimateLabel'),
      transferEstimateUnavailable: t('itineraryView.transferEstimateUnavailable'),
      transferEstimatePending: t('itineraryView.transferEstimatePending'),
      accommodationSummaryNights: t('itineraryView.accommodationSummaryNights'),
      accommodationSummaryCheckIn: t('itineraryView.accommodationSummaryCheckIn'),
      accommodationSummaryCheckOut: t('itineraryView.accommodationSummaryCheckOut'),
      accommodationSummaryEmpty: t('itineraryView.accommodationSummaryEmpty'),
      accommodationFieldGuests: t('itineraryView.accommodationFieldGuests'),
      accommodationFieldPlatform: t('itineraryView.accommodationFieldPlatform'),
      accommodationFieldContactPhone: t('itineraryView.accommodationFieldContactPhone'),
      accommodationFieldContactEmail: t('itineraryView.accommodationFieldContactEmail'),
      accommodationFieldBookingRef: t('itineraryView.accommodationFieldBookingRef'),
      flightNumber: t('itineraryView.flightNumber'),
      flightDeparture: t('itineraryView.flightDeparture'),
      flightArrival: t('itineraryView.flightArrival'),
      flightDuration: t('itineraryView.flightDuration'),
      platformOptions: {
        booking: t('itineraryView.platformOptions.booking'),
        airbnb: t('itineraryView.platformOptions.airbnb'),
        agoda: t('itineraryView.platformOptions.agoda'),
        direct: t('itineraryView.platformOptions.direct'),
        other: t('itineraryView.platformOptions.other'),
      },
      locationFallback: t('itineraryView.locationFallback'),
      openReferenceAria: (label) => t('itineraryView.openReferenceAria', { label }),
      openMapAria: (label) => t('itineraryView.openMapAria', { label }),
      footerSpanBeyondItinerary: Object.fromEntries(
        SPAN_ACTIVITY_CONFIGS.map((config) => [config.type, t(config.beyondItineraryLabelKey)]),
      ) as Partial<Record<ActivityType, string>>,
      validationMessages: {
        ...Object.fromEntries(ACTIVITY_VALIDATION_MESSAGE_KEYS.map((key) => [key, t(key)])),
        ...Object.fromEntries(
          SPAN_ACTIVITY_CONFIGS.map((config) => [config.missingClosureTimeLabelKey, t(config.missingClosureTimeLabelKey)]),
        ),
      },
    },
  }
}

export interface ActivityTileOptions {
  dayNumber: number | null
  getOwningDayDate: () => string | undefined
  photoThumbnailSize: PhotoThumbnailSize
  getPhotoThumbnailSize: () => PhotoThumbnailSize
  useModalEditor: boolean
  getActivityTypeLabel: (activity: ItineraryActivity) => string
  getActivityMeta: (activity: ItineraryActivity) => string[]
  getActivityFooter: (activity: ItineraryActivity) => ActivityFooterItem[]
  getLabels: () => ActivityTileLabels
  onActivityOpen: (activityId: string) => void
  onActivityDelete: (activityId: string) => void
  onActivityBench: (activity: ItineraryActivity) => void
}

export type PhotoThumbnailSize = 'sm' | 'md' | 'lg'

const PHOTO_THUMBNAIL_PRESETS: Record<PhotoThumbnailSize, { widthPx: number; widthRem: number }> = {
  sm: { widthPx: 160, widthRem: 6.2 },
  md: { widthPx: 220, widthRem: 8.4 },
  lg: { widthPx: 320, widthRem: 11.5 },
}

const TAP_MAX_MS = 260
const TAP_MAX_MOVE_PX = 8
const RECENT_DRAG_ACTIVITY_TTL_MS = 30_000
const MAX_VISIBLE_REFERENCES = 3
const MAX_VISIBLE_LOCATIONS = 3
const ACTIVITY_EDITOR_ACTIVE_CHANGE_EVENT = 'travenary:activity-editor-active-change'
export const ACTIVITY_EDITOR_CONFIRMED_EVENT = 'travenary:activity-editor-confirmed'
export const ACTIVITY_TILE_LABELS_CHANGED_EVENT = 'travenary:activity-tile-labels-changed'
const PHOTO_THUMBNAIL_SIZE_CHANGED_EVENT = 'travenary:photo-thumbnail-size-changed'

export type RecentlyDraggedActivity = {
  activity: ItineraryActivity
  sourceDayNumber: number | null
  capturedAt: number
}

let recentlyDraggedActivity: RecentlyDraggedActivity | null = null
let activeEditingActivityId: string | null = null
// When a freshly-inserted activity should open its editor as soon as its tile
// mounts. Module-level (like recentlyDraggedActivity) to avoid a dispatch/mount
// race between insertion and the React node view rendering.
let pendingAutoEditActivityId: string | null = null

/** Request that the tile for `activityId` opens its editor when it next mounts. */
export function requestActivityAutoEdit(activityId: string): void {
  pendingAutoEditActivityId = activityId
}

function cloneActivity(activity: ItineraryActivity): ItineraryActivity {
  return {
    ...activity,
    references: activity.references ? [...activity.references] : undefined,
    locations: activity.locations ? [...activity.locations] : undefined,
    details: activity.details ? { ...activity.details } : undefined,
  }
}

function toPrefillLocation(location: ActivityLocation | undefined): ActivityLocation | undefined {
  if (!location) {
    return undefined
  }

  const caption = location.caption?.trim()
  const address = location.address?.trim()
  const coordinates = Array.isArray(location.coordinates) && location.coordinates.length === 2 && hasCoordinates(location.coordinates)
    ? [...location.coordinates]
    : undefined

  if (!caption && !address && !coordinates) {
    return undefined
  }

  return {
    ...(caption ? { caption } : {}),
    showOnMap: location.showOnMap === true,
    ...(address ? { address } : {}),
    ...(coordinates ? { coordinates } : {}),
  }
}

// The location a following transfer's origin should inherit from this activity:
// a transfer hands off its destination (where the traveler arrived, whether or
// not it's map-pinned), every other activity hands off its last map-enabled
// location.
function toPrefillLocationForActivity(activity: ItineraryActivity | undefined): ActivityLocation | undefined {
  if (!activity) {
    return undefined
  }

  if (activity.type === 'transfer') {
    const arrival = toPrefillLocation(activity.details?.to)
    if (arrival) {
      return arrival
    }
  }

  const locations = activity.locations ?? []
  for (let index = locations.length - 1; index >= 0; index -= 1) {
    const prefill = toPrefillLocation(locations[index])
    if (prefill && prefill.showOnMap) {
      return prefill
    }
  }

  return undefined
}

function findLastMapEnabledLocationBeforePosition(editor: NodeViewProps['editor'], getPos?: NodeViewProps['getPos']): ActivityLocation | undefined {
  if (!editor || typeof getPos !== 'function') {
    return undefined
  }

  let cutoffPos: number
  try {
    const currentPos = getPos()
    if (typeof currentPos !== 'number') {
      return undefined
    }
    cutoffPos = currentPos
  } catch {
    return undefined
  }

  let found: ActivityLocation | undefined
  editor.state.doc.descendants((node, pos) => {
    if (pos >= cutoffPos) {
      return false
    }

    if (node.type.name !== 'activityTile') {
      return true
    }

    const candidate = toPrefillLocationForActivity(node.attrs?.activity as ItineraryActivity | undefined)
    if (candidate) {
      // Keep scanning: later (closer-preceding) activities overwrite, so the
      // surviving match is the one nearest the new transfer — "whichever is newer".
      found = candidate
    }

    return true
  })

  return found
}

export function getRecentlyDraggedActivity(activityId: string): ItineraryActivity | null {
  const snapshot = getRecentlyDraggedActivitySnapshot(activityId)
  return snapshot ? cloneActivity(snapshot.activity) : null
}

export function getRecentlyDraggedActivitySnapshot(activityId: string): RecentlyDraggedActivity | null {
  if (!recentlyDraggedActivity) {
    return null
  }

  const isExpired = Date.now() - recentlyDraggedActivity.capturedAt > RECENT_DRAG_ACTIVITY_TTL_MS
  if (isExpired || recentlyDraggedActivity.activity.id !== activityId) {
    return null
  }

  return {
    activity: cloneActivity(recentlyDraggedActivity.activity),
    sourceDayNumber: recentlyDraggedActivity.sourceDayNumber,
    capturedAt: recentlyDraggedActivity.capturedAt,
  }
}

function setActiveEditingActivity(activityId: string | null, notify = true): void {
  activeEditingActivityId = activityId

  if (!notify || typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<{ activityId: string | null }>(ACTIVITY_EDITOR_ACTIVE_CHANGE_EVENT, {
      detail: { activityId },
    }),
  )
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('a, button, input, textarea, summary'))
}

function openExternalUrl(url: string): void {
  if (typeof window === 'undefined') {
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

function ActivityTileView({ node, deleteNode, extension, selected, updateAttributes, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as ActivityTileAttributes
  const options = extension.options as ActivityTileOptions
  const activity = attrs.activity
  const useModalEditor = options.useModalEditor === true
  const labels = options.getLabels()
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isLegacySubmitting, setIsLegacySubmitting] = useState(false)
  const [photoThumbnailSize, setPhotoThumbnailSize] = useState<PhotoThumbnailSize>(() => options.getPhotoThumbnailSize())
  const [, setLabelsVersion] = useState(0)
  const pointerDownRef = useRef<{ x: number; y: number; startedAt: number } | null>(null)
  const activityId = activity?.id ?? null
  const transferPrefillFrom = useMemo(
    () => (activity?.type === 'transfer' && !activity.details?.from)
      ? findLastMapEnabledLocationBeforePosition(editor, getPos)
      : undefined,
    [activity, editor, getPos],
  )

  const typeLabel = useMemo(
    () => (activity ? options.getActivityTypeLabel(activity) : labels.titleFallback),
    [activity, labels.titleFallback, options],
  )
  // Not memoized: must recompute on the labels-changed re-render so locale
  // switches reformat the time range and footer warnings.
  const metaItems = activity ? options.getActivityMeta(activity) : []
  const footerItems = activity ? options.getActivityFooter(activity) : []

  useEffect(() => {
    const handleLabelsChanged = (): void => {
      setLabelsVersion((previousValue) => previousValue + 1)
    }

    window.addEventListener(ACTIVITY_TILE_LABELS_CHANGED_EVENT, handleLabelsChanged)

    return () => {
      window.removeEventListener(ACTIVITY_TILE_LABELS_CHANGED_EVENT, handleLabelsChanged)
    }
  }, [])

  const clearGlobalActiveIfCurrent = useCallback((): void => {
    if (activityId && activeEditingActivityId === activityId) {
      setActiveEditingActivity(null, false)
    }
  }, [activityId])

  function openActivityEditor(): void {
    if (activity) {
      options.onActivityOpen(activity.id)
    }

    setIsEditing(true)

    if (activityId) {
      setActiveEditingActivity(activityId)
    }
  }

  // Open the editor immediately for a just-created activity (see
  // requestActivityAutoEdit). Runs once when this tile's id is known.
  useEffect(() => {
    if (activityId && pendingAutoEditActivityId === activityId) {
      pendingAutoEditActivityId = null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openActivityEditor()
    }
    // openActivityEditor is stable enough for this one-shot mount check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const onActiveEditorChange = (event: Event): void => {
      const nextActivityId = (event as CustomEvent<{ activityId: string | null }>).detail?.activityId ?? null
      if (nextActivityId === null) {
        return
      }

      if (nextActivityId === activityId) {
        return
      }

      setIsEditing(false)
      clearGlobalActiveIfCurrent()
    }

    window.addEventListener(ACTIVITY_EDITOR_ACTIVE_CHANGE_EVENT, onActiveEditorChange)

    return () => {
      window.removeEventListener(ACTIVITY_EDITOR_ACTIVE_CHANGE_EVENT, onActiveEditorChange)
    }
  }, [activityId, isEditing, activity, clearGlobalActiveIfCurrent])

  useEffect(() => {
    return () => {
      clearGlobalActiveIfCurrent()
    }
  }, [clearGlobalActiveIfCurrent])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePhotoThumbnailSizeChanged = (): void => {
      setPhotoThumbnailSize(options.getPhotoThumbnailSize())
    }

    window.addEventListener(PHOTO_THUMBNAIL_SIZE_CHANGED_EVENT, handlePhotoThumbnailSizeChanged)

    return () => {
      window.removeEventListener(PHOTO_THUMBNAIL_SIZE_CHANGED_EVENT, handlePhotoThumbnailSizeChanged)
    }
  }, [options])

  function handleTilePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      pointerDownRef.current = null
      return
    }

    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      startedAt: Date.now(),
    }
  }

  function handleTilePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isInteractiveTarget(event.target)) {
      pointerDownRef.current = null
      return
    }

    const down = pointerDownRef.current
    pointerDownRef.current = null
    if (!down) {
      return
    }

    const movedX = Math.abs(event.clientX - down.x)
    const movedY = Math.abs(event.clientY - down.y)
    const elapsedMs = Date.now() - down.startedAt
    const isShortTap = elapsedMs <= TAP_MAX_MS && movedX <= TAP_MAX_MOVE_PX && movedY <= TAP_MAX_MOVE_PX

    if (!isShortTap) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    openActivityEditor()
  }

  function handleDragStart(event: ReactDragEvent<HTMLDivElement>): void {
    if (!activity) {
      return
    }

    recentlyDraggedActivity = {
      activity: cloneActivity(activity),
      sourceDayNumber: options.dayNumber,
      capturedAt: Date.now(),
    }
    event.dataTransfer.setData('application/x-travenary-activity-id', activity.id)
  }

  function suppressEditorFocus(event: { type: string; preventDefault: () => void; stopPropagation: () => void }): void {
    event.stopPropagation()
    // preventDefault only on the synthesized mousedown; doing it on pointerdown
    // makes Safari drop the subsequent click entirely.
    if (event.type !== 'pointerdown') {
      event.preventDefault()
    }
  }

  // Removing the node unmounts the dialog inside the contenteditable tree;
  // without this, iOS hands focus back to the editor and pops the keyboard.
  function releaseEditorFocusDeferred(): void {
    if (typeof window === 'undefined') {
      return
    }

    window.setTimeout(() => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }
    }, 0)
  }

  function deleteActivity(): void {
    if (activity) {
      options.onActivityDelete(activity.id)
    }
    setIsConfirmingDelete(false)
    deleteNode()
    releaseEditorFocusDeferred()
  }

  function benchActivity(): void {
    if (activity) {
      options.onActivityBench({ ...cloneActivity(activity), anchorDate: null })
    }
    setIsConfirmingDelete(false)
    deleteNode()
    releaseEditorFocusDeferred()
  }

  async function handleLegacyFormSave(nextActivity: ItineraryActivity): Promise<void> {
    if (!activity) {
      return
    }

    setIsLegacySubmitting(true)
    try {
      updateAttributes({
        activity: {
          ...nextActivity,
        },
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<{ activityId: string | null }>(ACTIVITY_EDITOR_CONFIRMED_EVENT, {
            detail: { activityId },
          }),
        )
      }

      setIsEditing(false)
      clearGlobalActiveIfCurrent()
    } finally {
      setIsLegacySubmitting(false)
    }
  }

  return (
    <NodeViewWrapper
      className={`${styles.activityNode}${selected ? ` ${styles.activityNodeSelected}` : ''}`}
      data-activity-id={activity?.id ?? ''}
      draggable={isEditing ? 'false' : 'true'}
    >
      <article className={styles.activityCard} contentEditable={false}>
        <button
          type="button"
          className={styles.deleteButton}
          aria-label={labels.deleteActivity}
          title={labels.deleteActivity}
          onPointerDown={(event) => {
            // Keep the editor from treating the press as content interaction,
            // but do not preventDefault here: Safari would then drop the click.
            event.stopPropagation()
          }}
          onMouseDown={(event) => {
            // iOS synthesizes mousedown after touchend; preventing it stops the
            // editor from gaining focus (and popping the keyboard) while the
            // click still fires.
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (typeof document !== 'undefined') {
              const activeElement = document.activeElement
              if (activeElement instanceof HTMLElement) {
                activeElement.blur()
              }
            }
            setIsConfirmingDelete(true)
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>

        {isConfirmingDelete ? (
          <DialogShell
            title={labels.deleteDialog.title}
            onClose={() => {
              setIsConfirmingDelete(false)
              releaseEditorFocusDeferred()
            }}
            footer={
              <>
                <button
                  type="button"
                  className={styles.deleteDialogBenchButton}
                  onPointerDown={suppressEditorFocus}
                  onMouseDown={suppressEditorFocus}
                  onClick={benchActivity}
                  disabled={Boolean(activity?.anchorDate)}
                  title={activity?.anchorDate ? labels.deleteDialog.benchBlockedAnchored : undefined}
                >
                  {labels.deleteDialog.bench}
                </button>
                <button
                  type="button"
                  className={styles.deleteDialogDeleteButton}
                  onPointerDown={suppressEditorFocus}
                  onMouseDown={suppressEditorFocus}
                  onClick={deleteActivity}
                >
                  {labels.deleteDialog.delete}
                </button>
              </>
            }
          >
            <p className={styles.deleteDialogMessage}>{labels.deleteDialog.message}</p>
            {activity?.anchorDate ? (
              <p className={styles.deleteDialogAnchoredNote}>{labels.deleteDialog.benchBlockedAnchored}</p>
            ) : null}
          </DialogShell>
        ) : null}

        <div
          className={styles.activityBody}
          data-drag-handle
          onDragStart={handleDragStart}
          onPointerDown={handleTilePointerDown}
          onPointerUp={handleTilePointerUp}
          onPointerCancel={() => {
            pointerDownRef.current = null
          }}
        >
          {activity ? (
            <ActivityTileDisplay
              activity={activity}
              labels={labels}
              metaItems={metaItems}
              footerItems={footerItems}
              photoThumbnailSize={photoThumbnailSize}
            />
          ) : (
            <ActivityTileFallback title={labels.titleFallback} typeLabel={typeLabel} />
          )}
        </div>

        {isEditing ? (
          <ActivityFormPanel
            activity={activity ?? undefined}
            activityType={activity?.type ?? 'note'}
            owningDayDate={options.getOwningDayDate()}
            mode={useModalEditor ? 'dialog' : 'inline'}
            disabled={isLegacySubmitting}
            transferPrefillFrom={transferPrefillFrom}
            onSave={async ({ activity: savedActivity }) => {
              await handleLegacyFormSave(savedActivity)
            }}
            onCancel={() => {
              setIsEditing(false)
              clearGlobalActiveIfCurrent()
            }}
          />
        ) : null}
      </article>
    </NodeViewWrapper>
  )
}

function ActivityTileFallback({
  title,
  typeLabel,
}: {
  title: string
  typeLabel: string
}) {
  return (
    <div className={`${styles.activityDisplay} ${styles.activityDisplayHeaderOnly}`} data-activity-type="custom">
      <header className={`${styles.activityHeader} ${styles.activityHeaderOnly}`}>
        <div className={styles.activityHeaderLine}>
          <span className={styles.activityIcon} aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <p className={styles.activityTitle}>{title || typeLabel}</p>
        </div>
      </header>
    </div>
  )
}

const FOOTER_SEVERITY_ICON: Record<ActivityFooterSeverity, typeof TriangleAlert> = {
  note: Info,
  warning: TriangleAlert,
  error: CircleAlert,
}

export function ActivityTileDisplay({
  activity,
  labels,
  metaItems,
  footerItems = [],
  photoThumbnailSize,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
  metaItems: string[]
  footerItems?: ActivityFooterItem[]
  photoThumbnailSize: PhotoThumbnailSize
}) {
  const Icon = ACTIVITY_TYPE_ICON[activity.type] ?? Sparkles
  const hasAnchoredDate = typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0
  const hasAccommodationSection = hasAccommodationDetails(activity)
  const hasTransferSection = hasTransferDetails(activity)
  const hasFlightSection = hasFlightDetails(activity)
  const detailItems = activity.type === 'accommodation' || activity.type === 'transfer' || activity.type === 'flight' ? [] : toActivityDetailItems(activity, labels)
  const thumbnailPreset = PHOTO_THUMBNAIL_PRESETS[photoThumbnailSize] ?? PHOTO_THUMBNAIL_PRESETS.md
  const references = activity.references ?? []
  const indexedReferences = references.map((reference, index) => ({ reference, index }))
  const indexedThumbnailReferences = indexedReferences
    .map(({ reference, index }) => ({
      reference,
      index,
      thumbnailUrl: getReferenceThumbnailUrl(reference, thumbnailPreset.widthPx),
    }))
    .filter((item): item is { reference: WebReference; index: number; thumbnailUrl: string } => Boolean(item.thumbnailUrl))
  const visiblePhotoThumbnails = indexedThumbnailReferences.slice(0, 2)
  const thumbnailIndexes = new Set(visiblePhotoThumbnails.map(({ index }) => index))
  const chipReferences = indexedReferences
    .filter(({ index }) => !thumbnailIndexes.has(index))
    .map(({ reference }) => reference)
  const orderedReferenceChips = toOrderedReferenceChips(chipReferences)
  const visibleReferenceChips = orderedReferenceChips.slice(0, MAX_VISIBLE_REFERENCES)
  const hiddenReferenceCount = Math.max(0, orderedReferenceChips.length - visibleReferenceChips.length)
  const locations = activity.locations ?? []
  const visibleLocations = locations.slice(0, MAX_VISIBLE_LOCATIONS)
  const hiddenLocationCount = Math.max(0, locations.length - visibleLocations.length)
  const hasBodyContent =
    hasAccommodationSection ||
    hasTransferSection ||
    hasFlightSection ||
    detailItems.length > 0 ||
    Boolean(activity.text?.trim()) ||
    visiblePhotoThumbnails.length > 0 ||
    visibleReferenceChips.length > 0 ||
    visibleLocations.length > 0 ||
    footerItems.length > 0
  const activityDisplayClassName = hasBodyContent
    ? styles.activityDisplay
    : `${styles.activityDisplay} ${styles.activityDisplayHeaderOnly}`
  const activityHeaderClassName = hasBodyContent
    ? styles.activityHeader
    : `${styles.activityHeader} ${styles.activityHeaderOnly}`

  return (
    <div className={activityDisplayClassName} data-activity-type={activity.type} data-anchored={hasAnchoredDate ? 'true' : undefined}>
      <header className={activityHeaderClassName}>
        <div className={styles.activityHeaderLine}>
          <span className={styles.activityIcon}>
            {hasAnchoredDate ? (
              <span className={styles.anchorIcon} role="img" aria-label={labels.display.anchored} title={labels.display.anchored}>
                <Anchor size={18} aria-hidden="true" />
              </span>
            ) : null}
            <Icon size={18} aria-hidden="true" />
          </span>
          <p className={styles.activityTitle}>{activity.title}</p>
          {metaItems.length > 0 ? <span className={styles.activityTime}>{metaItems.join(' / ')}</span> : null}
        </div>
      </header>

      {activity.text ? <p className={styles.activityDescription}>{activity.text}</p> : null}

      {hasAccommodationSection ? <AccommodationDetails activity={activity} labels={labels} /> : null}
      {hasTransferSection ? <TransferDetails activity={activity} labels={labels} /> : null}
      {hasFlightSection ? <FlightDetails activity={activity} labels={labels} /> : null}

      {detailItems.length > 0 ? (
        <div className={styles.detailList}>
          {detailItems.map((detailItem) => (
            <span key={detailItem} className={styles.detailChip}>
              {detailItem}
            </span>
          ))}
        </div>
      ) : null}

      {visibleReferenceChips.length > 0 || visiblePhotoThumbnails.length > 0 ? (
        <div className={styles.metaGroup}>
          {visiblePhotoThumbnails.length > 0 ? (
            <span className={styles.referenceThumbnails}>
              {visiblePhotoThumbnails.map(({ reference, index, thumbnailUrl }) => {
                const fullLinkLabel = toReferenceLabel(reference)
                const displayLinkLabel = toDisplayLabel(fullLinkLabel)

                return (
                  <button
                    type="button"
                    key={`thumb-${reference.url}-${index}`}
                    className={`${styles.referenceThumbnailLink} ${styles.buttonReset}`}
                    style={{ width: `${thumbnailPreset.widthRem}rem` }}
                    aria-label={labels.display.openReferenceAria(fullLinkLabel)}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      openExternalUrl(reference.url)
                    }}
                  >
                    <img
                      src={thumbnailUrl}
                      alt={displayLinkLabel}
                      loading="lazy"
                      decoding="async"
                      className={styles.referenceThumbnailImage}
                    />
                  </button>
                )
              })}
            </span>
          ) : null}

          {visibleReferenceChips.map((reference, index) => {
            const fullLinkLabel = toReferenceLabel(reference)
            const displayLinkLabel = toDisplayLabel(fullLinkLabel)
            const referenceChipType = toReferenceChipType(reference.type)
            const referenceChipClassName =
              referenceChipType === 'photo'
                ? `${styles.metaLink} ${styles.metaLinkReferencePhoto}`
                : referenceChipType === 'video'
                  ? `${styles.metaLink} ${styles.metaLinkReferenceVideo}`
                  : referenceChipType === 'webpage'
                    ? `${styles.metaLink} ${styles.metaLinkReferenceWebpage}`
                    : `${styles.metaLink} ${styles.metaLinkReferenceNoType}`
            const ReferenceChipIcon =
              referenceChipType === 'photo' ? Camera : referenceChipType === 'video' ? Film : Link2

            return (
              <button
                type="button"
                key={`${reference.url}-${index}`}
                className={`${referenceChipClassName} ${styles.buttonReset}`}
                aria-label={labels.display.openReferenceAria(fullLinkLabel)}
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  openExternalUrl(reference.url)
                }}
              >
                <ReferenceChipIcon aria-hidden="true" size={12} />
                <span>{displayLinkLabel}</span>
                <ExternalLink aria-hidden="true" size={12} />
              </button>
            )
          })}

          {hiddenReferenceCount > 0 ? <span className={styles.moreChip}>+{hiddenReferenceCount}</span> : null}
        </div>
      ) : null}

      {visibleLocations.length > 0 ? (
        <div className={`${styles.metaGroup} ${styles.metaGroupLocations}`}>
          {visibleLocations.map((location, index) => (
            <LocationChip
              key={`${toLocationKey(location, index, labels)}-${index}`}
              location={location}
              labels={labels}
              index={index}
            />
          ))}

          {hiddenLocationCount > 0 ? <span className={styles.moreChip}>+{hiddenLocationCount}</span> : null}
        </div>
      ) : null}

      {footerItems.length > 0 ? (
        <footer className={styles.activityFooter}>
          {footerItems.map((item, index) => {
            const FooterIcon = FOOTER_SEVERITY_ICON[item.severity]
            return (
              <p
                key={`${item.severity}-${index}`}
                className={styles.activityFooterItem}
                data-severity={item.severity}
              >
                <FooterIcon size={14} aria-hidden="true" />
                <span>{item.text}</span>
              </p>
            )
          })}
        </footer>
      ) : null}
    </div>
  )
}

function LocationChip({
  location,
  labels,
}: {
  location: ActivityLocation
  labels: ActivityTileLabels
  index: number
}) {
  const mapUrl = toGoogleMapsUrl({
    coordinates: location.coordinates,
    address: location.address,
  })
  const coordinatesLabel = toCoordinatesLabel(location.coordinates)
  const fullLocationLabel =
    location.caption?.trim() ||
    location.address?.trim() ||
    coordinatesLabel ||
    labels.display.locationFallback
  const displayLocationLabel = toTruncatedLabel(toDisplayLabel(fullLocationLabel), LOCATION_LABEL_MAX_LENGTH)
  const LocationIcon = location.showOnMap ? MapPinned : MapPin

  if (!mapUrl) {
    const locationChipClassName = location.showOnMap
      ? `${styles.metaChip} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
      : `${styles.metaChip} ${styles.metaLinkLocation}`

    return (
      <span className={locationChipClassName}>
        <LocationIcon aria-hidden="true" size={12} />
        <span title={fullLocationLabel}>{displayLocationLabel}</span>
      </span>
    )
  }

  const locationLinkClassName = location.showOnMap
    ? `${styles.metaLink} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
    : `${styles.metaLink} ${styles.metaLinkLocation}`

  return (
    <button
      type="button"
      className={`${locationLinkClassName} ${styles.buttonReset}`}
      aria-label={labels.display.openMapAria(fullLocationLabel)}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openExternalUrl(mapUrl)
      }}
    >
      <LocationIcon aria-hidden="true" size={12} />
      <span title={fullLocationLabel}>{displayLocationLabel}</span>
      <ExternalLink aria-hidden="true" size={12} />
    </button>
  )
}

function toActivityDetailItems(activity: ItineraryActivity, labels: ActivityTileLabels): string[] {
  const items: string[] = []

  if (activity.type === 'accommodation' && Number.isFinite(activity.details?.nights)) {
    items.push(labels.display.nights(Number(activity.details?.nights)))
  }

  if (activity.type === 'tour' && activity.details?.guidanceMode) {
    items.push(
      activity.details.guidanceMode === 'guided'
        ? labels.display.guidanceGuided
        : labels.display.guidanceSelfGuided,
    )
  }

  if (activity.type === 'food' && activity.details?.cuisine?.trim()) {
    items.push(labels.display.cuisineLabel(activity.details.cuisine.trim()))
  }

  return items
}

type ReferenceChipType = 'photo' | 'video' | 'webpage' | 'no-type'

function toReferenceChipTypeOrder(chipType: ReferenceChipType): number {
  if (chipType === 'photo') return 0
  if (chipType === 'video') return 1
  if (chipType === 'webpage') return 2
  return 3
}

function toOrderedReferenceChips(references: WebReference[]): WebReference[] {
  return references
    .map((reference, index) => ({
      reference,
      index,
      chipType: toReferenceChipType(reference.type),
    }))
    .sort((left, right) => {
      const orderDiff = toReferenceChipTypeOrder(left.chipType) - toReferenceChipTypeOrder(right.chipType)
      if (orderDiff !== 0) {
        return orderDiff
      }

      return left.index - right.index
    })
    .map((item) => item.reference)
}

function hasAccommodationDetails(activity: ItineraryActivity): boolean {
  if (activity.type !== 'accommodation' || !activity.details) {
    return false
  }

  const details = activity.details
  return [
    details.nights,
    details.guests,
    details.checkInFrom,
    details.checkInUntil,
    details.checkOutUntil,
    details.platform,
    details.contactPhone,
    details.contactEmail,
    details.bookingRef,
  ].some((value) => value !== undefined && String(value).trim() !== '')
}

function hasTransferDetails(activity: ItineraryActivity): boolean {
  if (activity.type !== 'transfer' || !activity.details) {
    return false
  }

  const details = activity.details
  return Boolean(
    details.to
    || details.from
    || details.mot
    || details.estimate?.value?.trim()
    || details.estimate?.source === 'fallback',
  )
}

function TransferDetails({
  activity,
  labels,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
}) {
  if (activity.type !== 'transfer' || !activity.details) {
    return null
  }

  const details = activity.details
  const motLabel = details.mot ? labels.display.transferMotOptions[details.mot] ?? details.mot : ''
  const estimateValue = details.estimate?.value?.trim()
    || (details.estimate?.source === 'fallback' ? labels.display.transferEstimateUnavailable : '')
  const directionsUrl = toGoogleMapsDirectionsUrl({
    from: details.from,
    to: details.to,
    mot: details.mot,
  })

  return (
    <section className={styles.transferDetails}>
      <div className={styles.transferSummary}>
        <div className={styles.transferSummaryLeft}>
          <span className={styles.transferSummaryItem}>
            <span>{labels.display.transferRouteTo}: </span>
            {details.to ? <LocationChip location={details.to} labels={labels} index={0} /> : <strong>-</strong>}
          </span>
        </div>

        <div className={styles.transferSummaryRight}>
          {motLabel || estimateValue ? (
            <>
              {motLabel ? <span>{motLabel}: </span> : null}
              {estimateValue ? (
                directionsUrl ? (
                  <button
                    type="button"
                    className={`${styles.metaLink} ${styles.transferEstimateChip} ${styles.buttonReset}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      openExternalUrl(directionsUrl)
                    }}
                  >
                    <Route aria-hidden="true" size={12} />
                    <span>{estimateValue}</span>
                    <ExternalLink aria-hidden="true" size={12} />
                  </button>
                ) : (
                  <span>{estimateValue}</span>
                )
              ) : motLabel ? (
                <span className={styles.transferEstimatePending}>{labels.display.transferEstimatePending}</span>
              ) : null}
            </>
          ) : <strong>-</strong>}
        </div>
      </div>

      <dl className={styles.transferGrid}>
        <div className={styles.transferRow}>
          <dt>{labels.display.transferRouteFrom}:</dt>
          <dd>
            {details.from ? <LocationChip location={details.from} labels={labels} index={1} /> : <strong>-</strong>}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function AccommodationDetails({
  activity,
  labels,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
}) {
  const [isOpen, setIsOpen] = useState(true)

  if (activity.type !== 'accommodation' || !activity.details) {
    return null
  }

  const details = activity.details
  const checkInFrom = formatLocalTime(details.checkInFrom, labels.locale)
  const checkInUntil = formatLocalTime(details.checkInUntil, labels.locale)
  const checkOutUntil = formatLocalTime(details.checkOutUntil, labels.locale)
  const summaryItems = [
    {
      key: 'nights',
      label: labels.display.accommodationSummaryNights,
      value: Number.isFinite(details.nights) ? String(details.nights) : '',
    },
    {
      key: 'checkIn',
      label: labels.display.accommodationSummaryCheckIn,
      value: formatTimeWindow(checkInFrom, checkInUntil),
    },
    {
      key: 'checkOut',
      label: labels.display.accommodationSummaryCheckOut,
      value: checkOutUntil,
    },
  ]
  const rows = [
    numberDetail(labels.display.accommodationFieldGuests, details.guests),
    textDetail(
      labels.display.accommodationFieldPlatform,
      details.platform ? labels.display.platformOptions[details.platform] : undefined,
    ),
    textDetail(labels.display.accommodationFieldContactPhone, details.contactPhone),
    textDetail(labels.display.accommodationFieldContactEmail, details.contactEmail),
    textDetail(labels.display.accommodationFieldBookingRef, details.bookingRef),
  ].filter((row): row is AccommodationDetailRow => row !== null)

  return (
    <section className={`${styles.accommodationDetails}${isOpen ? ` ${styles.accommodationDetailsOpen}` : ''}`}>
      <button
        type="button"
        className={styles.accommodationSummary}
        aria-expanded={isOpen}
        onPointerDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => {
          setIsOpen((previousValue) => !previousValue)
        }}
      >
        {summaryItems.map((item) => (
          <span key={item.key} className={styles.accommodationSummaryItem}>
            <span>{item.label}: </span>
            <strong>{item.value || labels.display.accommodationSummaryEmpty}</strong>
          </span>
        ))}
      </button>

      {isOpen && rows.length > 0 ? (
        <dl className={styles.accommodationGrid}>
          {rows.map((row) => (
            <div key={row.label} className={styles.accommodationRow}>
              <dt>{row.label}:</dt>
              <dd>
                <strong>{row.value}</strong>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

interface AccommodationDetailRow {
  label: string
  value: string
}

function hasFlightDetails(activity: ItineraryActivity): boolean {
  if (activity.type !== 'flight' || !activity.details) {
    return false
  }
  const details = activity.details
  return Boolean(
    details.flightNumber
    || details.departureAirport
    || details.arrivalAirport
    || details.bookingRef
    || activity.time
    || activity.timeEnd,
  )
}

// Render an airport as a transfer-style LocationChip so the user can click
// through to Google Maps, exactly like a transfer endpoint.
function airportToLocation(airport: FlightAirport | undefined): ActivityLocation | undefined {
  if (!airport?.iata) {
    return undefined
  }
  const caption = airport.name ? `${airport.iata} (${airport.name})` : airport.iata
  const address = [airport.name, airport.city, airport.country].filter(Boolean).join(', ')
  return {
    caption,
    showOnMap: airport.showOnMap === true,
    ...(address ? { address } : {}),
    ...(Array.isArray(airport.coordinates) && airport.coordinates.length === 2
      ? { coordinates: [airport.coordinates[0], airport.coordinates[1]] }
      : {}),
  }
}

// Minutes east of UTC for an IANA zone on a reference date (DST-aware via Intl).
function tzOffsetMinutes(tz: string | undefined, reference: Date): number | null {
  if (!tz) {
    return null
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(reference)
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!match) {
      return 0
    }
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + (match[3] ? Number(match[3]) : 0))
  } catch {
    return null
  }
}

function parseHhMm(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

// Real elapsed flight time from local dep/arr times + their timezones:
// (arrLocal - arrOffset) - (depLocal - depOffset), +24h when it lands next day.
function flightDurationMinutes(activity: ItineraryActivity, reference: Date): number | null {
  const depLocal = parseHhMm(activity.time)
  const arrLocal = parseHhMm(activity.timeEnd)
  if (depLocal === null || arrLocal === null) {
    return null
  }
  const depOffset = tzOffsetMinutes(activity.details?.departureAirport?.tz, reference)
  const arrOffset = tzOffsetMinutes(activity.details?.arrivalAirport?.tz, reference)
  if (depOffset === null || arrOffset === null) {
    return null
  }
  let minutes = (arrLocal - arrOffset) - (depLocal - depOffset)
  if (minutes < 0) {
    minutes += 24 * 60
  }
  return minutes
}

function formatHoursMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

function formatOffsetDelta(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  return mins === 0 ? `${sign}${hours}h` : `${sign}${hours}:${String(mins).padStart(2, '0')}`
}

function FlightDetails({
  activity,
  labels,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
}) {
  if (activity.type !== 'flight' || !activity.details) {
    return null
  }

  const details = activity.details
  const arrivalLocation = airportToLocation(details.arrivalAirport)
  const departureLocation = airportToLocation(details.departureAirport)
  const flightNumber = details.flightNumber?.trim()
  const bookingRef = details.bookingRef?.trim()
  const departureTime = formatLocalTime(activity.time, labels.locale)
  const arrivalTime = formatLocalTime(activity.timeEnd, labels.locale)
  const reference = new Date()
  const departureOffset = tzOffsetMinutes(details.departureAirport?.tz, reference)
  const arrivalOffset = tzOffsetMinutes(details.arrivalAirport?.tz, reference)
  const tzDelta = departureOffset !== null && arrivalOffset !== null ? arrivalOffset - departureOffset : null
  const arrivalSuffix = tzDelta !== null && tzDelta !== 0 ? ` (${formatOffsetDelta(tzDelta)})` : ''
  const durationMinutes = flightDurationMinutes(activity, reference)
  const durationText = durationMinutes !== null ? formatHoursMinutes(durationMinutes) : ''
  const hasTimes = Boolean(departureTime || arrivalTime || durationText)

  // Mirrors TransferDetails: To/From as clickable map chips, no estimate; plus
  // the flight-specific number, times, and booking reference.
  return (
    <section className={styles.transferDetails}>
      <div className={styles.transferSummary}>
        <div className={styles.transferSummaryLeft}>
          <span className={styles.transferSummaryItem}>
            <span>{labels.display.transferRouteTo}: </span>
            {arrivalLocation ? <LocationChip location={arrivalLocation} labels={labels} index={0} /> : <strong>-</strong>}
          </span>
        </div>

        <div className={styles.transferSummaryRight}>
          {flightNumber ? (
            <span>{labels.display.flightNumber}: <strong>{flightNumber}</strong></span>
          ) : null}
        </div>
      </div>

      {hasTimes ? (
        <div className={styles.flightTimes}>
          <div className={styles.flightTimesMain}>
            {departureTime ? <span>{labels.display.flightDeparture}: <strong>{departureTime}</strong></span> : null}
            {arrivalTime ? <span>{labels.display.flightArrival}: <strong>{arrivalTime}{arrivalSuffix}</strong></span> : null}
          </div>
          {durationText ? (
            <span className={styles.flightDuration}>{labels.display.flightDuration}: <strong>{durationText}</strong></span>
          ) : null}
        </div>
      ) : null}

      <dl className={styles.transferGrid}>
        <div className={styles.transferRow}>
          <dt>{labels.display.transferRouteFrom}:</dt>
          <dd>
            {departureLocation ? <LocationChip location={departureLocation} labels={labels} index={1} /> : <strong>-</strong>}
          </dd>
        </div>
        {bookingRef ? (
          <div className={styles.transferRow}>
            <dt>{labels.display.accommodationFieldBookingRef}:</dt>
            <dd><strong>{bookingRef}</strong></dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function numberDetail(label: string, value: number | undefined): AccommodationDetailRow | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null
  }

  return { label, value: String(value) }
}

function textDetail(label: string, value: string | undefined): AccommodationDetailRow | null {
  const normalized = value?.trim()
  return normalized ? { label, value: normalized } : null
}

function formatTimeWindow(start: string, end: string): string {
  if (start && end) {
    return `${start} - ${end}`
  }

  return start || end
}

function toDisplayLabel(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cap on the visible location chip label so long AI/user addresses don't break
// the activity tile layout. Full text is preserved for the title tooltip / aria.
const LOCATION_LABEL_MAX_LENGTH = 40

function toTruncatedLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}\u2026`
}

function toReferenceLabel(reference: WebReference): string {
  if (reference.caption?.trim()) {
    return reference.caption.trim()
  }

  try {
    const parsed = new URL(reference.url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname}${path}`
  } catch {
    return reference.url
  }
}

function toGoogleMapsDirectionsUrl({
  from,
  to,
  mot,
}: {
  from?: ActivityLocation
  to?: ActivityLocation
  mot?: string
}): string | null {
  if (!from || !to) {
    return null
  }

  const originQuery = toLocationQuery(from)
  const destinationQuery = toLocationQuery(to)

  if (!originQuery || !destinationQuery) {
    return null
  }

  const travelmode = motToGoogleMapsTravelmode(mot)
  const params = new URLSearchParams({
    api: '1',
    origin: originQuery,
    destination: destinationQuery,
  })

  if (travelmode) {
    params.set('travelmode', travelmode)
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function toValidCoordinatePair(coordinates?: number[]): [number, number] | null {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return null
  }

  const [longitude, latitude] = coordinates
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null
  }

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return null
  }

  return [longitude, latitude]
}

function toLocationQuery(location: ActivityLocation): string | null {
  const coordinates = toValidCoordinatePair(location.coordinates)
  if (coordinates) {
    const [longitude, latitude] = coordinates
    return `${latitude},${longitude}`
  }

  if (location.address?.trim()) {
    return location.address.trim()
  }

  return null
}

function motToGoogleMapsTravelmode(mot?: string): string | null {
  switch (mot) {
    case 'walk':
      return 'walking'
    case 'bike':
      return 'bicycling'
    case 'car':
    case 'motorcycle':
      return 'driving'
    case 'bus':
    case 'train':
    case 'plane':
      return 'transit'
    default:
      return null
  }
}

function toGoogleMapsUrl({
  coordinates,
  address,
}: {
  coordinates?: number[]
  address?: string
}): string | null {
  const validCoordinates = toValidCoordinatePair(coordinates)
  if (validCoordinates) {
    const [longitude, latitude] = validCoordinates
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
  }

  if (address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
  }

  return null
}

function toCoordinatesLabel(coordinates?: number[]): string {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return ''
  }

  const [longitude, latitude] = coordinates
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return ''
  }

  return `${longitude.toFixed(4)}, ${latitude.toFixed(4)}`
}

function toLocationKey(location: ActivityLocation, index: number, labels: ActivityTileLabels): string {
  return (
    location.caption?.trim() ||
    location.address?.trim() ||
    toCoordinatesLabel(location.coordinates) ||
    `${labels.display.locationFallback}-${index}`
  )
}

export const ActivityTile = Node.create<ActivityTileOptions>({
  name: 'activityTile',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      dayNumber: null,
      getOwningDayDate: () => undefined,
      photoThumbnailSize: 'md',
      getPhotoThumbnailSize: () => 'md',
      useModalEditor: false,
      getActivityTypeLabel: () => '',
      getActivityMeta: () => [],
      getActivityFooter: () => [],
      getLabels: () => ({
        locale: 'en',
        activityEditorLabel: '',
        deleteActivity: '',
        deleteDialog: {
          title: '',
          message: '',
          bench: '',
          delete: '',
          benchBlockedAnchored: '',
        },
        cancelEdit: '',
        confirmEdit: '',
        titleFallback: '',
        fields: {
          title: '',
          time: '',
          notes: '',
        },
        display: {
          anchored: '',
          nights: (count) => String(count),
          guidanceGuided: '',
          guidanceSelfGuided: '',
          cuisineLabel: (cuisine) => cuisine,
          transferRouteFrom: '',
          transferRouteTo: '',
          transferMotLabel: '',
          transferMotOptions: {
            walk: '',
            bike: '',
            motorcycle: '',
            car: '',
            bus: '',
            train: '',
          },
          transferEstimateLabel: '',
          transferEstimateUnavailable: '',
          transferEstimatePending: '',
          accommodationSummaryNights: '',
          accommodationSummaryCheckIn: '',
          accommodationSummaryCheckOut: '',
          accommodationSummaryEmpty: '',
          accommodationFieldGuests: '',
          accommodationFieldPlatform: '',
          accommodationFieldContactPhone: '',
          accommodationFieldContactEmail: '',
          accommodationFieldBookingRef: '',
          flightNumber: '',
          flightDeparture: '',
          flightArrival: '',
          flightDuration: '',
          platformOptions: {
            booking: '',
            airbnb: '',
            agoda: '',
            direct: '',
            other: '',
          },
          locationFallback: '',
          openReferenceAria: (label) => label,
          openMapAria: (label) => label,
          footerSpanBeyondItinerary: {},
          validationMessages: {},
        },
      }),
      onActivityOpen: () => undefined,
      onActivityDelete: () => undefined,
      onActivityBench: () => undefined,
    }
  },

  addAttributes() {
    return {
      activity: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="activity-tile"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'activity-tile' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ActivityTileView)
  },
})

export function createActivityTileNode(activity: ItineraryActivity) {
  return {
    type: 'activityTile',
    attrs: {
      activity: cloneActivity(activity),
    },
  }
}
