/* eslint-disable react-refresh/only-export-components */
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import {
  BedDouble,
  BusFront,
  Camera,
  Car,
  ExternalLink,
  Film,
  Footprints,
  Link2,
  MapPin,
  MapPinned,
  NotebookPen,
  Plane,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  AccommodationPlatform,
  ActivityLocation,
  ActivityType,
  ItineraryActivity,
  WebReference,
} from '@/services/contracts'
import { ActivityFormPanel } from '@/components/itinerary/ActivityFormPanel'
import { formatLocalTime } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from '@/tiptap/activity-tile-extension.module.css'

export type ActivityTileAttributes = {
  activity?: ItineraryActivity
}

export interface ActivityTileLabels {
  locale: string
  activityEditorLabel: string
  deleteActivity: string
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
    accommodationSummaryNights: string
    accommodationSummaryCheckIn: string
    accommodationSummaryCheckOut: string
    accommodationSummaryEmpty: string
    accommodationFieldGuests: string
    accommodationFieldPlatform: string
    accommodationFieldContactPhone: string
    accommodationFieldContactEmail: string
    accommodationFieldBookingRef: string
    platformOptions: Record<AccommodationPlatform, string>
    locationFallback: string
    openReferenceAria: (label: string) => string
    openMapAria: (label: string) => string
  }
}

export interface ActivityTileOptions {
  dayNumber: number | null
  useModalEditor: boolean
  getActivityTypeLabel: (activity: ItineraryActivity) => string
  getActivityMeta: (activity: ItineraryActivity) => string[]
  getLabels: () => ActivityTileLabels
  onActivityOpen: (activityId: string) => void
  onActivityDelete: (activityId: string) => void
}

const TAP_MAX_MS = 260
const TAP_MAX_MOVE_PX = 8
const RECENT_DRAG_ACTIVITY_TTL_MS = 30_000
const MAX_VISIBLE_REFERENCES = 3
const MAX_VISIBLE_LOCATIONS = 3
const ACTIVITY_EDITOR_ACTIVE_CHANGE_EVENT = 'travenary:activity-editor-active-change'
export const ACTIVITY_EDITOR_CONFIRMED_EVENT = 'travenary:activity-editor-confirmed'

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  note: NotebookPen,
  flight: Plane,
  accommodation: BedDouble,
  transfer: BusFront,
  poi: MapPin,
  carRental: Car,
  custom: Sparkles,
  food: UtensilsCrossed,
  divider: Sparkles,
  shopping: ShoppingBag,
  tour: Footprints,
}

export type RecentlyDraggedActivity = {
  activity: ItineraryActivity
  sourceDayNumber: number | null
  capturedAt: number
}

let recentlyDraggedActivity: RecentlyDraggedActivity | null = null
let activeEditingActivityId: string | null = null

function cloneActivity(activity: ItineraryActivity): ItineraryActivity {
  return {
    ...activity,
    references: activity.references ? [...activity.references] : undefined,
    locations: activity.locations ? [...activity.locations] : undefined,
    details: activity.details ? { ...activity.details } : undefined,
  }
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
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('a, button, input, textarea, summary'))
}

function ActivityTileView({ node, deleteNode, extension, selected, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as ActivityTileAttributes
  const options = extension.options as ActivityTileOptions
  const activity = attrs.activity
  const useModalEditor = options.useModalEditor === true
  const labels = options.getLabels()
  const [isEditing, setIsEditing] = useState(false)
  const [isLegacySubmitting, setIsLegacySubmitting] = useState(false)
  const pointerDownRef = useRef<{ x: number; y: number; startedAt: number } | null>(null)
  const activityId = activity?.id ?? null

  const typeLabel = useMemo(
    () => (activity ? options.getActivityTypeLabel(activity) : labels.titleFallback),
    [activity, labels.titleFallback, options],
  )
  const metaItems = useMemo(() => (activity ? options.getActivityMeta(activity) : []), [activity, options])

  function clearGlobalActiveIfCurrent(): void {
    if (activityId && activeEditingActivityId === activityId) {
      setActiveEditingActivity(null, false)
    }
  }

  function openActivityEditor(): void {
    if (activity) {
      options.onActivityOpen(activity.id)
    }

    setIsEditing(true)

    if (activityId) {
      setActiveEditingActivity(activityId)
    }
  }

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
  }, [activityId, isEditing, activity])

  useEffect(() => {
    return () => {
      clearGlobalActiveIfCurrent()
    }
  }, [activityId])

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
    if (isEditing) {
      event.preventDefault()
      return
    }

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

  function deleteActivity(): void {
    if (activity) {
      options.onActivityDelete(activity.id)
    }
    deleteNode()
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
      draggable={!isEditing}
    >
      <article className={styles.activityCard} contentEditable={false}>
        <button
          type="button"
          className={styles.deleteButton}
          aria-label={labels.deleteActivity}
          title={labels.deleteActivity}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            deleteActivity()
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>

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
            <ActivityTileDisplay activity={activity} labels={labels} metaItems={metaItems} />
          ) : (
            <ActivityTileFallback title={labels.titleFallback} typeLabel={typeLabel} />
          )}
        </div>

        {isEditing ? (
          <ActivityFormPanel
            activity={activity ?? undefined}
            activityType={activity?.type ?? 'note'}
            mode={useModalEditor ? 'dialog' : 'inline'}
            disabled={isLegacySubmitting}
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

function ActivityTileDisplay({
  activity,
  labels,
  metaItems,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
  metaItems: string[]
}) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? Sparkles
  const hasAnchoredDate = typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0
  const hasAccommodationSection = hasAccommodationDetails(activity)
  const detailItems = activity.type === 'accommodation' ? [] : toActivityDetailItems(activity, labels)
  const references = activity.references ?? []
  const indexedReferences = references.map((reference, index) => ({ reference, index }))
  const indexedPhotoReferences = indexedReferences.filter(({ reference }) => reference.type === 'photo')
  const visiblePhotoThumbnails = indexedPhotoReferences.slice(0, 2)
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
    detailItems.length > 0 ||
    Boolean(activity.text?.trim()) ||
    visiblePhotoThumbnails.length > 0 ||
    visibleReferenceChips.length > 0 ||
    visibleLocations.length > 0
  const activityDisplayClassName = hasBodyContent
    ? styles.activityDisplay
    : `${styles.activityDisplay} ${styles.activityDisplayHeaderOnly}`
  const activityHeaderClassName = hasBodyContent
    ? styles.activityHeader
    : `${styles.activityHeader} ${styles.activityHeaderOnly}`

  return (
    <div className={activityDisplayClassName} data-activity-type={activity.type}>
      <header className={activityHeaderClassName}>
        <div className={styles.activityHeaderLine}>
          <span className={styles.activityIcon} aria-hidden="true">
            <Icon size={18} />
          </span>
          <p className={styles.activityTitle}>{activity.title}</p>
          {metaItems.length > 0 ? <span className={styles.activityTime}>{metaItems.join(' / ')}</span> : null}
        </div>

        {hasAnchoredDate ? (
          <div className={styles.activityHeaderNote}>
            <span className={styles.anchoredChip}>{labels.display.anchored}</span>
          </div>
        ) : null}
      </header>

      {hasAccommodationSection ? <AccommodationDetails activity={activity} labels={labels} /> : null}

      {detailItems.length > 0 ? (
        <div className={styles.detailList}>
          {detailItems.map((detailItem) => (
            <span key={detailItem} className={styles.detailChip}>
              {detailItem}
            </span>
          ))}
        </div>
      ) : null}

      {activity.text ? <p className={styles.activityDescription}>{activity.text}</p> : null}

      {visibleReferenceChips.length > 0 || visiblePhotoThumbnails.length > 0 ? (
        <div className={styles.metaGroup}>
          {visiblePhotoThumbnails.length > 0 ? (
            <span className={styles.referenceThumbnails}>
              {visiblePhotoThumbnails.map(({ reference, index }) => {
                const fullLinkLabel = toReferenceLabel(reference)
                const displayLinkLabel = toDisplayLabel(fullLinkLabel)
                const thumbnailUrl = unsplashUrl(reference.url, 160, 70)

                return (
                  <a
                    key={`thumb-${reference.url}-${index}`}
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.referenceThumbnailLink}
                    data-no-auto-external-icon="true"
                    aria-label={labels.display.openReferenceAria(fullLinkLabel)}
                  >
                    <img
                      src={thumbnailUrl}
                      alt={displayLinkLabel}
                      loading="lazy"
                      decoding="async"
                      className={styles.referenceThumbnailImage}
                    />
                  </a>
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
              <a
                key={`${reference.url}-${index}`}
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className={referenceChipClassName}
                data-no-auto-external-icon="true"
                aria-label={labels.display.openReferenceAria(fullLinkLabel)}
              >
                <ReferenceChipIcon aria-hidden="true" size={12} />
                <span>{displayLinkLabel}</span>
                {referenceChipType !== 'photo' ? <ExternalLink aria-hidden="true" size={12} /> : null}
              </a>
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
  const displayLocationLabel = toDisplayLabel(fullLocationLabel)
  const LocationIcon = location.showOnMap ? MapPinned : MapPin

  if (!mapUrl) {
    const locationChipClassName = location.showOnMap
      ? `${styles.metaChip} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
      : `${styles.metaChip} ${styles.metaLinkLocation}`

    return (
      <span className={locationChipClassName}>
        <LocationIcon aria-hidden="true" size={12} />
        <span>{displayLocationLabel}</span>
      </span>
    )
  }

  const locationLinkClassName = location.showOnMap
    ? `${styles.metaLink} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
    : `${styles.metaLink} ${styles.metaLinkLocation}`

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={locationLinkClassName}
      data-no-auto-external-icon="true"
      aria-label={labels.display.openMapAria(fullLocationLabel)}
    >
      <LocationIcon aria-hidden="true" size={12} />
      <span>{displayLocationLabel}</span>
      <ExternalLink aria-hidden="true" size={12} />
    </a>
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

function toReferenceChipType(type?: string): ReferenceChipType {
  if (type === 'photo') return 'photo'
  if (type === 'video') return 'video'
  if (type === 'webpage') return 'webpage'
  return 'no-type'
}

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

function AccommodationDetails({
  activity,
  labels,
}: {
  activity: ItineraryActivity
  labels: ActivityTileLabels
}) {
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
    <details className={styles.accommodationDetails}>
      <summary className={styles.accommodationSummary}>
        {summaryItems.map((item) => (
          <span key={item.key} className={styles.accommodationSummaryItem}>
            <span>{item.label}: </span>
            <strong>{item.value || labels.display.accommodationSummaryEmpty}</strong>
          </span>
        ))}
      </summary>

      {rows.length > 0 ? (
        <dl className={styles.accommodationGrid}>
          {rows.map((row) => (
            <div key={row.label} className={styles.accommodationRow}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </details>
  )
}

interface AccommodationDetailRow {
  label: string
  value: string
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

function toGoogleMapsUrl({
  coordinates,
  address,
}: {
  coordinates?: number[]
  address?: string
}): string | null {
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const [longitude, latitude] = coordinates
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    }
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
      useModalEditor: false,
      getActivityTypeLabel: () => '',
      getActivityMeta: () => [],
      getLabels: () => ({
        locale: 'en',
        activityEditorLabel: '',
        deleteActivity: '',
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
          accommodationSummaryNights: '',
          accommodationSummaryCheckIn: '',
          accommodationSummaryCheckOut: '',
          accommodationSummaryEmpty: '',
          accommodationFieldGuests: '',
          accommodationFieldPlatform: '',
          accommodationFieldContactPhone: '',
          accommodationFieldContactEmail: '',
          accommodationFieldBookingRef: '',
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
        },
      }),
      onActivityOpen: () => undefined,
      onActivityDelete: () => undefined,
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
