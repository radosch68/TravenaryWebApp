import {
  CircleAlert,
  BedDouble,
  Anchor,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ExternalLink,
  Film,
  Map,
  Link2,
  MapPin,
  MapPinned,
  MoonStar,
  Redo2,
  Undo2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  DayRichTextEditor,
  type DayRichTextEditorHistoryActions,
  type DayRichTextEditorHistoryState,
  type DayRichTextSaveState,
} from '@/components/itinerary/DayRichTextEditor'
import type { DayDocumentNode, ItineraryActivity, ItineraryDay, WebReference } from '@/services/contracts'
import { ACTIVITY_TYPE_ICON } from '@/components/itinerary/activity-presentation'
import { hasCoordinates } from '@/components/itinerary/location-map-pins'
import { formatLocalDate, formatLocalTime, formatLocalTimeRange, formatWeekday, getTodayLocalIsoDate } from '@/utils/date-format'
import {
  getOvernightCoverageByGapDay,
  getVirtualAccommodationCheckoutsByDay,
  type OvernightCoverage,
  type VirtualAccommodationCheckout,
} from '@/utils/itinerary-grouping'
import { getReferenceThumbnailUrl, toReferenceChipType } from '@/utils/reference-url'
import { toDayActivities } from '@/utils/tiptap-compatibility'

import styles from './ItineraryDaysGrid.module.css'
import editorStyles from './DayRichTextEditor.module.css'

interface ItineraryDaysGridProps {
  days: ItineraryDay[]
  locale: string
  draftCacheIdentity?: string
  photoThumbnailSize?: PhotoThumbnailSize
  editable?: boolean
  fullBleedOnMobile?: boolean
  buildDayMapRoute?: (dayNumber: number) => string | null
  collapseCommandToken?: number
  collapseCommandMode?: 'collapse-all' | 'expand-all'
  onCollapseStateChange?: (state: { allCollapsed: boolean; allExpanded: boolean }) => void
  activityBench?: ItineraryActivity[]
  onActivityBench?: (activity: ItineraryActivity) => void
  onDaySave?: (day: Omit<ItineraryDay, 'date'> & { activityBench?: ItineraryActivity[] }) => Promise<void>
}

function toSelectorAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

const MAX_VISIBLE_REFERENCES = 3
const MAX_VISIBLE_LOCATIONS = 3
const DAY_SAVE_SUCCESS_FLASH_MS = 1000
const TWO_COLUMN_BREAKPOINT_REM = 64
const THREE_COLUMN_BREAKPOINT_REM = 96
const MIN_COLUMN_RATIO = 0.3
const DEFAULT_TWO_COLUMN_RATIOS: [number, number] = [0.5, 0.5]
const DEFAULT_THREE_COLUMN_RATIOS: [number, number, number] = [1 / 3, 1 / 3, 1 / 3]

export type PhotoThumbnailSize = 'sm' | 'md' | 'lg'

const PHOTO_THUMBNAIL_PRESETS: Record<PhotoThumbnailSize, { widthPx: number; widthRem: number }> = {
  sm: { widthPx: 160, widthRem: 6.2 },
  md: { widthPx: 220, widthRem: 8.4 },
  lg: { widthPx: 320, widthRem: 11.5 },
}

type DaySaveVisualState = 'success' | 'error'
type DayExpandState = 'expanded' | 'partial' | 'collapsed'
// The toggle bounces (expanded -> partial -> collapsed -> partial -> expanded),
// so a partial day remembers which way it is heading. 'expanded' is not stored.
type StoredDayExpandState = 'partial-collapsing' | 'collapsed' | 'partial-expanding'
type DayEditorHistoryState = DayRichTextEditorHistoryState
type ActiveDividerDrag = {
  pointerId: number
  columnCount: 2 | 3
  dividerIndex: number
  startClientX: number
  startRatios: [number, number] | [number, number, number]
  availableWidth: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isHeaderInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('button, a, input, textarea, select, [role="button"]'))
}

function cloneDayDocument(document: DayDocumentNode[]): DayDocumentNode[] {
  return JSON.parse(JSON.stringify(document)) as DayDocumentNode[]
}

function toDocumentSignature(document: DayDocumentNode[]): string {
  const serialized = JSON.stringify(document)
  let hash = 2166136261

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${serialized.length}:${(hash >>> 0).toString(36)}`
}

function toDayDraftCacheSignature(days: ItineraryDay[], draftCacheIdentity?: string): string {
  return [
    draftCacheIdentity ?? '',
    ...days.map((day) => {
      const summary = day.summary?.trim() ?? ''
      const date = day.date ?? ''
      const documentSignature = toDocumentSignature(day.document ?? [])
      return `${day.dayNumber}:${date}:${summary}:${documentSignature}`
    }),
  ].join('|')
}

export function ItineraryDaysGrid({
  days,
  locale,
  draftCacheIdentity,
  photoThumbnailSize = 'md',
  editable = false,
  fullBleedOnMobile = false,
  buildDayMapRoute,
  collapseCommandToken,
  collapseCommandMode,
  onCollapseStateChange,
  activityBench,
  onActivityBench,
  onDaySave,
}: ItineraryDaysGridProps): ReactElement {
  const { t } = useTranslation('common')
  const gridRef = useRef<HTMLElement | null>(null)
  const activeDividerDragRef = useRef<ActiveDividerDrag | null>(null)
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])

  const sortedDays = useMemo(
    () => [...days].sort((left, right) => left.dayNumber - right.dayNumber),
    [days],
  )
  const overnightCoverageByGapDay = useMemo(
    () => getOvernightCoverageByGapDay(sortedDays),
    [sortedDays],
  )
  const virtualAccommodationCheckoutsByDay = useMemo(
    () => getVirtualAccommodationCheckoutsByDay(sortedDays),
    [sortedDays],
  )
  const [dayExpandStates, setDayExpandStates] = useState<globalThis.Map<number, StoredDayExpandState>>(
    () => new globalThis.Map(),
  )
  const [daySaveVisualStates, setDaySaveVisualStates] = useState<globalThis.Map<number, DaySaveVisualState>>(
    () => new globalThis.Map(),
  )
  const [activeSavedOkDayNumber, setActiveSavedOkDayNumber] = useState<number | null>(null)
  // Lazy editor mounting: at most one day mounts a live TipTap editor at a time
  // (the rest render the cheap static `DayDocumentView`). Tapping a static day
  // makes it active; switching unmounts the previous editor (which auto-saves).
  const [activeEditorDayNumber, setActiveEditorDayNumber] = useState<number | null>(null)
  const pendingFocusCoordsRef = useRef<{ x: number; y: number } | 'end' | null>(null)
  const [dayEditorHistoryStates, setDayEditorHistoryStates] = useState<globalThis.Map<number, DayEditorHistoryState>>(
    () => new globalThis.Map(),
  )
  const dayHeaderObserversRef = useRef<globalThis.Map<number, ResizeObserver>>(
    new globalThis.Map<number, ResizeObserver>(),
  )
  const dayEditorHistoryActionsRef = useRef<Record<number, DayRichTextEditorHistoryActions>>({})
  const saveSuccessTimersRef = useRef<globalThis.Map<number, number>>(new globalThis.Map())
  const skipHeaderSummaryBlurSaveRef = useRef(false)
  const [isPointerCoarse, setIsPointerCoarse] = useState(false)
  const [desktopColumnCount, setDesktopColumnCount] = useState<1 | 2 | 3>(1)
  const [gridWidthPx, setGridWidthPx] = useState(0)
  const [gridGapPx, setGridGapPx] = useState(12)
  const [twoColumnRatios, setTwoColumnRatios] = useState<[number, number]>(DEFAULT_TWO_COLUMN_RATIOS)
  const [threeColumnRatios, setThreeColumnRatios] = useState<[number, number, number]>(DEFAULT_THREE_COLUMN_RATIOS)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [editingHeaderDayNumber, setEditingHeaderDayNumber] = useState<number | null>(null)
  const [headerSummaryDraft, setHeaderSummaryDraft] = useState('')
  const [isHeaderSummarySaving, setIsHeaderSummarySaving] = useState(false)
  const dayDocumentDraftByDayRef = useRef<Record<number, DayDocumentNode[]>>({})
  const dayDraftCacheSignatureRef = useRef<string>('')

  useEffect(() => {
    const dayNumbers = new Set(sortedDays.map((day) => day.dayNumber))
    const nextDayDraftCacheSignature = toDayDraftCacheSignature(sortedDays, draftCacheIdentity)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDayExpandStates((previousValue) => {
      const nextValue = new globalThis.Map<number, StoredDayExpandState>()
      previousValue.forEach((expandState, dayNumber) => {
        if (dayNumbers.has(dayNumber)) {
          nextValue.set(dayNumber, expandState)
        }
      })
      return nextValue.size === previousValue.size ? previousValue : nextValue
    })

    setDaySaveVisualStates((previousValue) => {
      let didChange = false
      const nextValue = new globalThis.Map<number, DaySaveVisualState>()
      previousValue.forEach((state, dayNumber) => {
        if (dayNumbers.has(dayNumber)) {
          nextValue.set(dayNumber, state)
          return
        }

        didChange = true
      })

      return didChange ? nextValue : previousValue
    })

    setActiveSavedOkDayNumber((previousValue) => {
      if (previousValue === null || dayNumbers.has(previousValue)) {
        return previousValue
      }

      return null
    })

    setDayEditorHistoryStates((previousValue) => {
      let didChange = false
      const nextValue = new globalThis.Map<number, DayEditorHistoryState>()
      previousValue.forEach((state, dayNumber) => {
        if (dayNumbers.has(dayNumber)) {
          nextValue.set(dayNumber, state)
          return
        }

        didChange = true
      })

      return didChange ? nextValue : previousValue
    })

    const nextHistoryActions: Record<number, DayRichTextEditorHistoryActions> = {}
    Object.entries(dayEditorHistoryActionsRef.current).forEach(([dayNumberKey, actions]) => {
      const dayNumber = Number(dayNumberKey)
      if (!Number.isFinite(dayNumber) || !dayNumbers.has(dayNumber)) {
        return
      }

      nextHistoryActions[dayNumber] = actions
    })
    dayEditorHistoryActionsRef.current = nextHistoryActions

    if (dayDraftCacheSignatureRef.current !== nextDayDraftCacheSignature) {
      // Rebuild cache when day identity/content changes so stale drafts cannot
      // survive renumbering or same-number replacements from a new itinerary payload.
      dayDocumentDraftByDayRef.current = sortedDays.reduce<Record<number, DayDocumentNode[]>>((acc, day) => {
        acc[day.dayNumber] = cloneDayDocument(day.document ?? [])
        return acc
      }, {})
      dayDraftCacheSignatureRef.current = nextDayDraftCacheSignature
      return
    }

    const draftCache = dayDocumentDraftByDayRef.current
    const nextDraftCache: Record<number, DayDocumentNode[]> = {}
    let didPruneDraftCache = false

    Object.entries(draftCache).forEach(([dayNumberKey, documentDraft]) => {
      const dayNumber = Number(dayNumberKey)
      if (!Number.isFinite(dayNumber) || !dayNumbers.has(dayNumber)) {
        didPruneDraftCache = true
        return
      }

      nextDraftCache[dayNumber] = documentDraft
    })

    if (didPruneDraftCache) {
      dayDocumentDraftByDayRef.current = nextDraftCache
    }
  }, [draftCacheIdentity, sortedDays])

  useEffect(() => {
    const dayHeaderObservers = dayHeaderObserversRef.current
    const saveSuccessTimers = saveSuccessTimersRef.current
    return () => {
      dayHeaderObservers.forEach((observer) => {
        observer.disconnect()
      })
      dayHeaderObservers.clear()

      saveSuccessTimers.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      saveSuccessTimers.clear()
      activeDividerDragRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const coarsePointerMedia = window.matchMedia('(pointer: coarse)')

    function updatePointerMode(): void {
      setIsPointerCoarse(coarsePointerMedia.matches)
    }

    function updateDesktopColumnCount(): void {
      const rootFontSizePx =
        Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16') || 16
      const viewportWidthPx = window.innerWidth

      if (viewportWidthPx >= THREE_COLUMN_BREAKPOINT_REM * rootFontSizePx) {
        setDesktopColumnCount(3)
        return
      }

      if (viewportWidthPx >= TWO_COLUMN_BREAKPOINT_REM * rootFontSizePx) {
        setDesktopColumnCount(2)
        return
      }

      setDesktopColumnCount(1)
    }

    updatePointerMode()
    updateDesktopColumnCount()

    coarsePointerMedia.addEventListener('change', updatePointerMode)
    window.addEventListener('resize', updateDesktopColumnCount)

    return () => {
      coarsePointerMedia.removeEventListener('change', updatePointerMode)
      window.removeEventListener('resize', updateDesktopColumnCount)
    }
  }, [])

  useEffect(() => {
    const element = gridRef.current
    if (!element) {
      return
    }

    function updateGridMetrics(): void {
      const currentElement = gridRef.current
      if (!currentElement) {
        return
      }

      const computedStyle = window.getComputedStyle(currentElement)
      const gapPx = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || '12') || 12
      const widthPx = currentElement.getBoundingClientRect().width

      setGridGapPx(gapPx)
      setGridWidthPx(widthPx)
    }

    updateGridMetrics()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateGridMetrics)
      return () => {
        window.removeEventListener('resize', updateGridMetrics)
      }
    }

    const observer = new ResizeObserver(updateGridMetrics)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!collapseCommandToken || !collapseCommandMode) {
      return
    }

    if (collapseCommandMode === 'collapse-all') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDayExpandStates(new globalThis.Map(sortedDays.map((day) => [day.dayNumber, 'collapsed' as StoredDayExpandState])))
      return
    }

    setDayExpandStates(new globalThis.Map())
  }, [collapseCommandMode, collapseCommandToken, sortedDays])

  useEffect(() => {
    const totalDays = sortedDays.length
    const collapsedCount = sortedDays.filter((day) => dayExpandStates.get(day.dayNumber) === 'collapsed').length
    const expandedCount = sortedDays.filter((day) => dayExpandStates.get(day.dayNumber) === undefined).length
    const allExpanded = expandedCount === totalDays
    const allCollapsed = totalDays > 0 && collapsedCount === totalDays

    onCollapseStateChange?.({ allCollapsed, allExpanded })
  }, [dayExpandStates, onCollapseStateChange, sortedDays])

  // Bounce through the states: expanded -> partial -> collapsed -> partial ->
  // expanded. In the partial state the day text stays visible while activity
  // tiles collapse to their headers.
  const cycleDayExpandState = useCallback((dayNumber: number): void => {
    setDayExpandStates((previousValue) => {
      const nextValue = new globalThis.Map(previousValue)
      const currentState = previousValue.get(dayNumber)
      if (currentState === undefined) {
        nextValue.set(dayNumber, 'partial-collapsing')
      } else if (currentState === 'partial-collapsing') {
        nextValue.set(dayNumber, 'collapsed')
      } else if (currentState === 'collapsed') {
        nextValue.set(dayNumber, 'partial-expanding')
      } else {
        nextValue.delete(dayNumber)
      }
      return nextValue
    })
  }, [])

  const jumpToAccommodationSource = useCallback((targetDayNumber: number, sourceActivityId: string): void => {
    if (!sourceActivityId || !Number.isFinite(targetDayNumber)) {
      return
    }

    const activitySelector = `[data-activity-id="${toSelectorAttributeValue(sourceActivityId)}"]`

    setDayExpandStates((previousValue) => {
      if (previousValue.get(targetDayNumber) !== 'collapsed') {
        return previousValue
      }

      const nextValue = new globalThis.Map(previousValue)
      nextValue.delete(targetDayNumber)
      return nextValue
    })

    const scrollToActivity = (attempt = 0): void => {
      const activityElement = document.querySelector(activitySelector) as HTMLElement | null
      if (activityElement) {
        activityElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }

      if (attempt >= 8) {
        const dayElement = document.getElementById(`itinerary-day-${targetDayNumber}`)
        dayElement?.scrollIntoView({ block: 'start', behavior: 'smooth' })
        return
      }

      window.setTimeout(() => {
        scrollToActivity(attempt + 1)
      }, 60)
    }

    window.setTimeout(() => {
      scrollToActivity(0)
    }, 0)
  }, [])

  const jumpToCoveredAccommodation = useCallback((coverage: OvernightCoverage): void => {
    if (coverage.status !== 'covered' || !coverage.accommodationActivityId || !coverage.accommodationDayNumber) {
      return
    }

    jumpToAccommodationSource(coverage.accommodationDayNumber, coverage.accommodationActivityId)
  }, [jumpToAccommodationSource])

  const setDayHeaderElement = useCallback((dayNumber: number, headerElement: HTMLElement | null): void => {
    const previousObserver = dayHeaderObserversRef.current.get(dayNumber)
    previousObserver?.disconnect()
    dayHeaderObserversRef.current.delete(dayNumber)

    if (!headerElement) {
      return
    }

    const header = headerElement
    const dayCardElement = header.closest('article') as HTMLElement | null
    if (!dayCardElement) {
      return
    }

    function updateHeaderHeight(): void {
      dayCardElement?.style.setProperty(
        '--day-header-sticky-height',
        `${header.getBoundingClientRect().height}px`,
      )
    }

    updateHeaderHeight()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(header)
    dayHeaderObserversRef.current.set(dayNumber, observer)
  }, [])

  const setDaySaveVisualState = useCallback((dayNumber: number, state: DayRichTextSaveState): void => {
    if (state !== 'saved' && state !== 'error' && state !== 'dirty' && state !== 'saving') {
      return
    }

    const existingTimer = saveSuccessTimersRef.current.get(dayNumber)
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer)
      saveSuccessTimersRef.current.delete(dayNumber)
    }

    if (state === 'error') {
      setActiveSavedOkDayNumber((previousValue) => {
        if (previousValue !== dayNumber) {
          return previousValue
        }

        return null
      })

      setDaySaveVisualStates((previousValue) => {
        const nextValue = new globalThis.Map(previousValue)
        nextValue.set(dayNumber, 'error')
        return nextValue
      })
      return
    }

    if (state === 'dirty' || state === 'saving') {

      setDaySaveVisualStates((previousValue) => {
        if (!previousValue.has(dayNumber)) {
          return previousValue
        }

        const nextValue = new globalThis.Map(previousValue)
        nextValue.delete(dayNumber)
        return nextValue
      })
      return
    }

    setActiveSavedOkDayNumber(dayNumber)

    setDaySaveVisualStates((previousValue) => {
      const nextValue = new globalThis.Map(previousValue)
      nextValue.set(dayNumber, 'success')
      return nextValue
    })

    const timerId = window.setTimeout(() => {
      saveSuccessTimersRef.current.delete(dayNumber)
      setDaySaveVisualStates((previousValue) => {
        if (previousValue.get(dayNumber) !== 'success') {
          return previousValue
        }

        const nextValue = new globalThis.Map(previousValue)
        nextValue.delete(dayNumber)
        return nextValue
      })
    }, DAY_SAVE_SUCCESS_FLASH_MS)

    saveSuccessTimersRef.current.set(dayNumber, timerId)
  }, [])

  const handleDayEditorActivate = useCallback((dayNumber: number): void => {
    setActiveSavedOkDayNumber(dayNumber)
  }, [])

  // Mount the editor for `dayNumber` (unmounting any other active editor, which
  // flushes its save) and remember where the user tapped so the caret lands
  // there once the editor mounts.
  const activateDayEditor = useCallback(
    (dayNumber: number, coords: { x: number; y: number } | 'end' | null): void => {
      pendingFocusCoordsRef.current = coords
      setActiveEditorDayNumber(dayNumber)
      setActiveSavedOkDayNumber(dayNumber)
    },
    [],
  )

  const consumePendingFocusCoords = useCallback((): { x: number; y: number } | 'end' | null => {
    const coords = pendingFocusCoordsRef.current
    pendingFocusCoordsRef.current = null
    return coords
  }, [])

  // Drop the active editor if its day no longer exists (deleted/renumbered) so we
  // never try to mount an editor for a missing day.
  useEffect(() => {
    if (activeEditorDayNumber !== null && !sortedDays.some((day) => day.dayNumber === activeEditorDayNumber)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveEditorDayNumber(null)
    }
  }, [activeEditorDayNumber, sortedDays])

  const setDayEditorHistoryState = useCallback((dayNumber: number, state: DayEditorHistoryState): void => {
    setDayEditorHistoryStates((previousValue) => {
      const existingValue = previousValue.get(dayNumber)
      if (existingValue?.canUndo === state.canUndo && existingValue?.canRedo === state.canRedo) {
        return previousValue
      }

      const nextValue = new globalThis.Map(previousValue)
      nextValue.set(dayNumber, state)
      return nextValue
    })
  }, [])

  const setDayEditorHistoryActions = useCallback((dayNumber: number, actions: DayRichTextEditorHistoryActions | null): void => {
    if (actions) {
      dayEditorHistoryActionsRef.current[dayNumber] = actions
      return
    }

    delete dayEditorHistoryActionsRef.current[dayNumber]
  }, [])

  const triggerDayHistoryAction = useCallback((dayNumber: number, action: keyof DayRichTextEditorHistoryActions): void => {
    handleDayEditorActivate(dayNumber)
    dayEditorHistoryActionsRef.current[dayNumber]?.[action]()
  }, [handleDayEditorActivate])

  const handleDayDocumentDraftChange = useCallback((dayNumber: number, document: DayDocumentNode[]): void => {
    dayDocumentDraftByDayRef.current[dayNumber] = cloneDayDocument(document)
  }, [])

  const startHeaderSummaryEdit = useCallback((day: ItineraryDay): void => {
    setEditingHeaderDayNumber(day.dayNumber)
    setHeaderSummaryDraft(day.summary ?? '')
    handleDayEditorActivate(day.dayNumber)
  }, [handleDayEditorActivate])

  const cancelHeaderSummaryEdit = useCallback((): void => {
    if (isHeaderSummarySaving) {
      return
    }

    skipHeaderSummaryBlurSaveRef.current = false
    setEditingHeaderDayNumber(null)
    setHeaderSummaryDraft('')
  }, [isHeaderSummarySaving])

  const saveHeaderSummary = useCallback(async (day: ItineraryDay): Promise<void> => {
    if (!onDaySave || isHeaderSummarySaving) {
      return
    }

    // Send an empty string (not undefined) when clearing, so the key survives
    // JSON serialization and the backend actually unsets the summary.
    const nextSummary = headerSummaryDraft.trim()
    const currentSummary = day.summary?.trim() ?? ''

    if (nextSummary === currentSummary) {
      setEditingHeaderDayNumber(null)
      setHeaderSummaryDraft('')
      return
    }

    setIsHeaderSummarySaving(true)
    setDaySaveVisualState(day.dayNumber, 'saving')

    try {
      const latestDocumentDraft = dayDocumentDraftByDayRef.current[day.dayNumber]
      await onDaySave({
        dayNumber: day.dayNumber,
        summary: nextSummary,
        document: cloneDayDocument(latestDocumentDraft ?? (day.document ?? [])),
      })

      setDaySaveVisualState(day.dayNumber, 'saved')
      handleDayEditorActivate(day.dayNumber)
    } catch {
      setDaySaveVisualState(day.dayNumber, 'error')
    } finally {
      setIsHeaderSummarySaving(false)
      setEditingHeaderDayNumber(null)
      setHeaderSummaryDraft('')
    }
  }, [handleDayEditorActivate, headerSummaryDraft, isHeaderSummarySaving, onDaySave, setDaySaveVisualState])

  const switchHeaderSummaryEdit = useCallback(async (day: ItineraryDay): Promise<void> => {
    if (isHeaderSummarySaving) {
      return
    }

    if (editingHeaderDayNumber === null || editingHeaderDayNumber === day.dayNumber) {
      startHeaderSummaryEdit(day)
      return
    }

    const previousEditingDay = sortedDays.find(
      (candidateDay) => candidateDay.dayNumber === editingHeaderDayNumber,
    )

    if (previousEditingDay) {
      await saveHeaderSummary(previousEditingDay)
    }

    startHeaderSummaryEdit(day)
  }, [editingHeaderDayNumber, isHeaderSummarySaving, saveHeaderSummary, sortedDays, startHeaderSummaryEdit])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    function handleDocumentPointerDown(event: PointerEvent): void {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        setActiveSavedOkDayNumber(null)
        return
      }

      if (target.closest('[data-day-rich-editor-root="true"], [data-day-header-editor-root="true"]')) {
        return
      }

      setActiveSavedOkDayNumber(null)
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    }
  }, [])

  const handleGridPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      setActiveSavedOkDayNumber(null)
      return
    }

    if (target.closest('[data-day-rich-editor-root="true"], [data-day-header-editor-root="true"]')) {
      return
    }

    setActiveSavedOkDayNumber(null)
  }, [])

  const availableGridWidthPx = useMemo(() => {
    const columns = desktopColumnCount
    const available = gridWidthPx - gridGapPx * Math.max(columns - 1, 0)
    return Math.max(available, 0)
  }, [desktopColumnCount, gridGapPx, gridWidthPx])

  const normalizedTwoColumnRatios = useMemo<[number, number]>(() => {
    const left = clamp(twoColumnRatios[0], MIN_COLUMN_RATIO, 1 - MIN_COLUMN_RATIO)
    return [left, 1 - left]
  }, [twoColumnRatios])

  const normalizedThreeColumnRatios = useMemo<[number, number, number]>(() => {
    const [leftRaw, centerRaw, rightRaw] = threeColumnRatios
    const sumRaw = leftRaw + centerRaw + rightRaw || 1
    const left = clamp(leftRaw / sumRaw, MIN_COLUMN_RATIO, 1 - 2 * MIN_COLUMN_RATIO)
    let center = clamp(centerRaw / sumRaw, MIN_COLUMN_RATIO, 1 - left - MIN_COLUMN_RATIO)
    let right = 1 - left - center

    if (right < MIN_COLUMN_RATIO) {
      const deficit = MIN_COLUMN_RATIO - right
      center = clamp(center - deficit, MIN_COLUMN_RATIO, 1 - left - MIN_COLUMN_RATIO)
      right = 1 - left - center
    }

    return [left, center, right]
  }, [threeColumnRatios])

  const gridInlineStyle = useMemo<CSSProperties | undefined>(() => {
    if (isPointerCoarse || desktopColumnCount === 1) {
      return undefined
    }

    if (desktopColumnCount === 2) {
      const [left, right] = normalizedTwoColumnRatios
      return {
        gridTemplateColumns: `minmax(0, ${left}fr) minmax(0, ${right}fr)`,
      }
    }

    const [left, center, right] = normalizedThreeColumnRatios
    return {
      gridTemplateColumns: `minmax(0, ${left}fr) minmax(0, ${center}fr) minmax(0, ${right}fr)`,
    }
  }, [desktopColumnCount, isPointerCoarse, normalizedThreeColumnRatios, normalizedTwoColumnRatios])

  const dividerOffsetsPx = useMemo<number[]>(() => {
    if (isPointerCoarse || desktopColumnCount < 2 || availableGridWidthPx <= 0) {
      return []
    }

    if (desktopColumnCount === 2) {
      const leftWidthPx = normalizedTwoColumnRatios[0] * availableGridWidthPx
      return [leftWidthPx + gridGapPx / 2]
    }

    const leftWidthPx = normalizedThreeColumnRatios[0] * availableGridWidthPx
    const centerWidthPx = normalizedThreeColumnRatios[1] * availableGridWidthPx
    return [
      leftWidthPx + gridGapPx / 2,
      leftWidthPx + gridGapPx + centerWidthPx + gridGapPx / 2,
    ]
  }, [
    availableGridWidthPx,
    desktopColumnCount,
    gridGapPx,
    isPointerCoarse,
    normalizedThreeColumnRatios,
    normalizedTwoColumnRatios,
  ])

  const handleDividerPointerDown = useCallback((dividerIndex: number, event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || isPointerCoarse || desktopColumnCount < 2 || availableGridWidthPx <= 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const activeColumnCount: 2 | 3 = desktopColumnCount === 2 ? 2 : 3

    activeDividerDragRef.current = {
      pointerId: event.pointerId,
      columnCount: activeColumnCount,
      dividerIndex,
      startClientX: event.clientX,
      startRatios:
        activeColumnCount === 2
          ? [...normalizedTwoColumnRatios]
          : [...normalizedThreeColumnRatios],
      availableWidth: availableGridWidthPx,
    }
    setIsDraggingDivider(true)
  }, [
    availableGridWidthPx,
    desktopColumnCount,
    isPointerCoarse,
    normalizedThreeColumnRatios,
    normalizedTwoColumnRatios,
  ])

  const handleDividerPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    const activeDrag = activeDividerDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId || activeDrag.availableWidth <= 0) {
      return
    }

    event.preventDefault()
    const deltaRatio = (event.clientX - activeDrag.startClientX) / activeDrag.availableWidth

    if (activeDrag.columnCount === 2) {
      const [startLeft] = activeDrag.startRatios as [number, number]
      const nextLeft = clamp(startLeft + deltaRatio, MIN_COLUMN_RATIO, 1 - MIN_COLUMN_RATIO)
      setTwoColumnRatios([nextLeft, 1 - nextLeft])
      return
    }

    const [startLeft, startCenter, startRight] = activeDrag.startRatios as [number, number, number]
    if (activeDrag.dividerIndex === 0) {
      const pairTotal = startLeft + startCenter
      const nextLeft = clamp(startLeft + deltaRatio, MIN_COLUMN_RATIO, pairTotal - MIN_COLUMN_RATIO)
      const nextCenter = pairTotal - nextLeft
      setThreeColumnRatios([nextLeft, nextCenter, startRight])
      return
    }

    const pairTotal = startCenter + startRight
    const nextCenter = clamp(startCenter + deltaRatio, MIN_COLUMN_RATIO, pairTotal - MIN_COLUMN_RATIO)
    const nextRight = pairTotal - nextCenter
    setThreeColumnRatios([startLeft, nextCenter, nextRight])
  }, [])

  const handleDividerPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    const activeDrag = activeDividerDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    activeDividerDragRef.current = null
    setIsDraggingDivider(false)
  }, [])

  const handleDividerDoubleClick = useCallback((): void => {
    activeDividerDragRef.current = null
    setIsDraggingDivider(false)
    setTwoColumnRatios(DEFAULT_TWO_COLUMN_RATIOS)
    setThreeColumnRatios(DEFAULT_THREE_COLUMN_RATIOS)
  }, [])

  return (
    <section
      ref={gridRef}
      className={`${styles.daysGrid}${fullBleedOnMobile ? ` ${styles.fullBleedOnMobile}` : ''}`}
      data-resizable-columns={isPointerCoarse ? 1 : desktopColumnCount}
      data-is-dragging-divider={isDraggingDivider ? 'true' : 'false'}
      style={gridInlineStyle}
      onPointerDownCapture={handleGridPointerDownCapture}
      aria-label={t('itineraryView.daysAriaLabel')}
    >
      {sortedDays.map((day, index) => {
        const storedExpandState = dayExpandStates.get(day.dayNumber)
        const dayExpandState: DayExpandState =
          storedExpandState === undefined ? 'expanded' : storedExpandState === 'collapsed' ? 'collapsed' : 'partial'
        const isCollapsed = dayExpandState === 'collapsed'
        const dayVirtualCheckouts = virtualAccommodationCheckoutsByDay.get(day.dayNumber) ?? []
        const coverage =
            index < sortedDays.length - 1
              ? overnightCoverageByGapDay.get(day.dayNumber) ?? { status: 'missing' }
            : null
        const dayMapRoute = buildDayMapRoute?.(day.dayNumber) ?? null
        const dayActivities = toDayActivities(day)
        const hasDayMapLocations = hasMappableLocations(dayActivities)
        const isToday = day.date === todayIsoDate
        const saveVisualState = daySaveVisualStates.get(day.dayNumber)
        const isDaySavedOk = activeSavedOkDayNumber === day.dayNumber
        const isEditingHeaderSummary = editingHeaderDayNumber === day.dayNumber
        const dayEditorHistoryState = dayEditorHistoryStates.get(day.dayNumber) ?? { canUndo: false, canRedo: false }
        // Undo/redo only apply to the day with the live editor (lazy-mount).
        const isEditorActiveDay = editable && Boolean(onDaySave) && activeEditorDayNumber === day.dayNumber
        const shouldShowDayHeaderActions = Boolean(isEditorActiveDay || (hasDayMapLocations && dayMapRoute))
        const dayCardClassName = [
          styles.dayCard,
          isToday ? styles.dayCardToday : '',
          isDaySavedOk ? styles.dayCardSaveOk : '',
          saveVisualState === 'success' ? styles.dayCardSaveSuccess : '',
          saveVisualState === 'error' ? styles.dayCardSaveError : '',
        ].filter(Boolean).join(' ')

        return (
          <article
            id={`itinerary-day-${day.dayNumber}`}
            key={`itinerary-day-${day.dayNumber}`}
            className={dayCardClassName}
            aria-current={isToday ? 'date' : undefined}
          >
            <header
              ref={(element) => setDayHeaderElement(day.dayNumber, element)}
              className={styles.dayHeader}
              onClick={(event) => {
                if (isHeaderInteractiveTarget(event.target)) {
                  return
                }

                const dayAnchorId = `itinerary-day-${day.dayNumber}`
                const dayElement = document.getElementById(dayAnchorId)
                if (!dayElement) {
                  return
                }

                dayElement.scrollIntoView({ block: 'start' })
              }}
            >
              <div className={styles.dayHeaderTopRow}>
                <div className={styles.dayHeaderPrimary}>
                  <button
                    type="button"
                    className={styles.dayToggleButton}
                    onClick={() => cycleDayExpandState(day.dayNumber)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`itinerary-day-content-${day.dayNumber}`}
                    aria-label={
                      storedExpandState === undefined
                        ? t('itineraryView.collapseDayActivitiesAria', { dayNumber: day.dayNumber })
                        : storedExpandState === 'partial-collapsing'
                          ? t('itineraryView.collapseDayAria', { dayNumber: day.dayNumber })
                          : storedExpandState === 'collapsed'
                            ? t('itineraryView.expandDayActivitiesAria', { dayNumber: day.dayNumber })
                            : t('itineraryView.expandDayAria', { dayNumber: day.dayNumber })
                    }
                  >
                    {dayExpandState === 'expanded' ? (
                      <ChevronsDown size={19} className={styles.dayToggleIcon} aria-hidden="true" />
                    ) : dayExpandState === 'partial' ? (
                      <ChevronDown size={19} className={styles.dayToggleIcon} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={19} className={styles.dayToggleIcon} aria-hidden="true" />
                    )}
                  </button>
                  <p className={styles.dayNumber}>{day.dayNumber}</p>
                </div>

                <div className={styles.dayDateStack}>
                  <p className={styles.dayWeekday}>
                    {day.date ? formatWeekday(day.date, locale) : '—'}
                  </p>
                  <p className={styles.dayDate}>
                    {day.date ? formatLocalDate(day.date, locale) : t('itineraryView.missingDate')}
                  </p>
                </div>

                {shouldShowDayHeaderActions ? (
                  <div className={styles.dayHeaderActions}>
                    {isEditorActiveDay ? (
                      <div className={styles.dayHistoryActions} aria-label={t('itineraryView.editHistoryLabel')} role="group">
                        <button
                          type="button"
                          className={styles.dayHistoryButton}
                          onClick={() => triggerDayHistoryAction(day.dayNumber, 'undo')}
                          aria-label={t('itineraryView.undoAria')}
                          title={t('itineraryView.undoAria')}
                          disabled={!dayEditorHistoryState.canUndo}
                        >
                          <Undo2 size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={styles.dayHistoryButton}
                          onClick={() => triggerDayHistoryAction(day.dayNumber, 'redo')}
                          aria-label={t('itineraryView.redoAria')}
                          title={t('itineraryView.redoAria')}
                          disabled={!dayEditorHistoryState.canRedo}
                        >
                          <Redo2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}

                    {hasDayMapLocations && dayMapRoute ? (
                      <Link
                        className={styles.dayMapLauncher}
                        to={dayMapRoute}
                        aria-label={t('itineraryView.openDailyMapAria', { dayNumber: day.dayNumber })}
                        title={t('itineraryView.openDailyMapAria', { dayNumber: day.dayNumber })}
                      >
                        <Map size={17} aria-hidden="true" />
                        <span>{t('itineraryView.dailyMap')}</span>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.dayHeaderSummaryRow} data-day-header-editor-root="true">
                {editable && onDaySave ? (
                  isEditingHeaderSummary ? (
                    <form
                      className={styles.dayHeaderSummaryForm}
                      onBlurCapture={(event) => {
                        const nextTarget = event.relatedTarget
                        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                          return
                        }

                        if (skipHeaderSummaryBlurSaveRef.current) {
                          skipHeaderSummaryBlurSaveRef.current = false
                          return
                        }

                        void saveHeaderSummary(day)
                      }}
                      onSubmit={(event) => {
                        event.preventDefault()
                        void saveHeaderSummary(day)
                      }}
                    >
                      <textarea
                        className={styles.dayHeaderSummaryTextarea}
                        value={headerSummaryDraft}
                        onFocus={() => handleDayEditorActivate(day.dayNumber)}
                        onChange={(event) => {
                          setHeaderSummaryDraft(event.target.value)
                          setDaySaveVisualState(day.dayNumber, 'dirty')
                          handleDayEditorActivate(day.dayNumber)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelHeaderSummaryEdit()
                          }
                        }}
                        rows={2}
                        placeholder={t('itineraryView.daySummaryPlaceholder')}
                        aria-label={t('itineraryView.editDaySummaryAria', { dayNumber: day.dayNumber })}
                        disabled={isHeaderSummarySaving}
                        autoFocus
                      />
                      <div className={styles.dayHeaderSummaryActions}>
                        <button
                          type="button"
                          className={styles.dayHeaderSummaryCancelButton}
                          onPointerDown={() => {
                            skipHeaderSummaryBlurSaveRef.current = true
                          }}
                          onClick={cancelHeaderSummaryEdit}
                          disabled={isHeaderSummarySaving}
                          aria-label={t('itineraryView.cancel')}
                        >
                          ✕
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={styles.dayHeaderSummaryDisplay}
                      onClick={() => {
                        void switchHeaderSummaryEdit(day)
                      }}
                      aria-label={t('itineraryView.editDaySummaryAria', { dayNumber: day.dayNumber })}
                    >
                      {day.summary?.trim().length
                        ? day.summary
                        : t('itineraryView.daySummaryPlaceholder')}
                    </button>
                  )
                ) : (
                  <p className={styles.dayHeaderSummaryText}>
                    {day.summary?.trim().length
                      ? day.summary
                      : t('itineraryView.daySummaryPlaceholder')}
                  </p>
                )}
              </div>
            </header>

            {!isCollapsed ? (
              <div id={`itinerary-day-content-${day.dayNumber}`} data-day-expand={dayExpandState}>
                {dayVirtualCheckouts.map((checkout) => (
                  <VirtualAccommodationCheckoutTile
                    key={`virtual-checkout-${checkout.sourceActivityId}-${checkout.dayNumber}`}
                    checkout={checkout}
                    locale={locale}
                    onClick={() => {
                      jumpToAccommodationSource(checkout.sourceDayNumber, checkout.sourceActivityId)
                    }}
                  />
                ))}

                {editable && onDaySave ? (
                  activeEditorDayNumber === day.dayNumber ? (
                    <DayRichTextEditor
                      day={day}
                      locale={locale}
                      photoThumbnailSize={photoThumbnailSize}
                      activityBench={activityBench}
                      onActivityBench={onActivityBench}
                      onDaySave={onDaySave}
                      onEditorActivate={() => handleDayEditorActivate(day.dayNumber)}
                      onDocumentDraftChange={handleDayDocumentDraftChange}
                      onHistoryStateChange={(state) => setDayEditorHistoryState(day.dayNumber, state)}
                      onHistoryActionsChange={(actions) => setDayEditorHistoryActions(day.dayNumber, actions)}
                      onSaveStateChange={(state) => setDaySaveVisualState(day.dayNumber, state)}
                      getInitialFocusCoords={consumePendingFocusCoords}
                    />
                  ) : (
                    <div
                      className={styles.dayEditorActivator}
                      tabIndex={0}
                      aria-label={t('itineraryView.editDayActivitiesAria', { dayNumber: day.dayNumber })}
                      onClick={(event) => {
                        // Let links/buttons inside the static day behave normally.
                        if ((event.target as HTMLElement).closest('a, button')) {
                          return
                        }
                        activateDayEditor(day.dayNumber, { x: event.clientX, y: event.clientY })
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) {
                          return
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          activateDayEditor(day.dayNumber, 'end')
                        }
                      }}
                    >
                      <DayDocumentView day={day} locale={locale} photoThumbnailSize={photoThumbnailSize} />
                    </div>
                  )
                ) : (
                  <DayDocumentView day={day} locale={locale} photoThumbnailSize={photoThumbnailSize} />
                )}

              </div>
            ) : null}

            {coverage ? <DayStatusFooter coverage={coverage} onCoveredClick={jumpToCoveredAccommodation} /> : null}
          </article>
        )
      })}

      {dividerOffsetsPx.map((offsetPx, dividerIndex) => (
        <button
          key={`column-divider-${desktopColumnCount}-${dividerIndex}`}
          type="button"
          className={styles.columnDivider}
          style={{ left: `${offsetPx}px` }}
          onPointerDown={(event) => handleDividerPointerDown(dividerIndex, event)}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          onPointerCancel={handleDividerPointerUp}
          onDoubleClick={handleDividerDoubleClick}
          tabIndex={-1}
          aria-hidden="true"
        />
      ))}
    </section>
  )
}

function hasMappableLocations(activities: ItineraryActivity[]): boolean {
  return activities.some((activity) => {
    const locations = activity.locations ?? []
    return locations.some((location) => location.showOnMap && hasCoordinates(location.coordinates))
  })
}

function DayStatusFooter({
  coverage,
  onCoveredClick,
}: {
  coverage: OvernightCoverage
  onCoveredClick: (coverage: OvernightCoverage) => void
}): ReactElement {
  const { t } = useTranslation('common')

  const isCovered = coverage.status === 'covered'
  const nightFraction =
    isCovered && Number.isFinite(coverage.nightNumber) && Number.isFinite(coverage.totalNights)
      ? `${coverage.nightNumber}/${coverage.totalNights}`
      : null
  const nightLabel = isCovered ? t('itineraryView.overnightNightLabel') : null

  const bannerLabel =
    coverage.status === 'covered'
      ? [
          coverage.accommodationTitle,
          nightLabel && nightFraction ? `${nightLabel}: ${nightFraction}` : null,
        ].filter(Boolean).join(' - ')
      : coverage.status === 'multiple'
        ? t('itineraryView.overnightMultiple', { count: coverage.count ?? 2 })
        : t('itineraryView.overnightMissing')

  const BannerIcon =
    coverage.status === 'covered'
      ? MoonStar
      : coverage.status === 'multiple'
        ? TriangleAlert
        : CircleAlert

  const footerClassName = `${styles.dayFooter} ${styles[`dayFooter${toStatusClassName(coverage.status)}`]}`

  if (isCovered) {
    return (
      <button
        type="button"
        className={`${footerClassName} ${styles.dayFooterAction}`}
        aria-label={bannerLabel}
        title={bannerLabel}
        onClick={() => {
          onCoveredClick(coverage)
        }}
      >
        <span className={styles.overnightLeft}>
          <BannerIcon aria-hidden="true" size={15} />
          <span className={styles.overnightLabel}>{coverage.accommodationTitle}</span>
        </span>
        {nightLabel && nightFraction ? (
          <span className={styles.overnightProgress}>
            <span>{nightLabel}: </span>
            <strong>{nightFraction}</strong>
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className={footerClassName} aria-label={bannerLabel} title={bannerLabel}>
      <span className={styles.overnightLeft}>
        <BannerIcon aria-hidden="true" size={15} />
        <span className={styles.overnightLabel}>{bannerLabel}</span>
      </span>
    </div>
  )
}

function documentNodeText(nodes: DayDocumentNode[] | undefined): string {
  if (!Array.isArray(nodes)) {
    return ''
  }

  return nodes
    .map((node) => (typeof node.text === 'string' ? node.text : documentNodeText(node.content)))
    .join('')
}

function renderInlineNode(node: DayDocumentNode, key: string): ReactNode {
  if (node.type === 'hardBreak') {
    return <br key={key} />
  }

  if (typeof node.text !== 'string') {
    return node.content ? <Fragment key={key}>{renderInlineNodes(node.content, key)}</Fragment> : null
  }

  let element: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') {
      element = <strong>{element}</strong>
    } else if (mark.type === 'italic') {
      element = <em>{element}</em>
    } else if (mark.type === 'underline') {
      element = <u>{element}</u>
    } else if (mark.type === 'strike') {
      element = <s>{element}</s>
    } else if (mark.type === 'code') {
      element = <code>{element}</code>
    } else if (mark.type === 'link') {
      const linkAttrs = mark.attrs as { href?: string } | undefined
      const href = typeof linkAttrs?.href === 'string' ? linkAttrs.href : undefined
      element = (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {element}
        </a>
      )
    }
  }

  return <Fragment key={key}>{element}</Fragment>
}

function renderInlineNodes(nodes: DayDocumentNode[] | undefined, keyPrefix: string): ReactNode {
  if (!Array.isArray(nodes)) {
    return null
  }

  return nodes.map((node, index) => renderInlineNode(node, `${keyPrefix}-i${index}`))
}

// Faithful read-only mirror of the day editor: walks the canonical document in
// order and renders activity tiles, section breaks, and rich prose with the
// same markup/classes the editor produces (reusing `.editorSurface`), so the
// shared view matches the editable page minus the editing affordances.
function renderDocumentBlockNode(
  node: DayDocumentNode,
  key: string,
  context: { locale: string; photoThumbnailSize: PhotoThumbnailSize },
): ReactNode {
  switch (node.type) {
    case 'activityTile': {
      const activity = node.attrs?.activity as ItineraryActivity | undefined
      if (!activity?.id) {
        return null
      }
      return (
        <ActivityCard
          key={key}
          activity={activity}
          locale={context.locale}
          photoThumbnailSize={context.photoThumbnailSize}
        />
      )
    }
    case 'sectionBreak': {
      return (
        <div key={key} className={editorStyles.sectionBreak} data-type="section-break">
          {documentNodeText(node.content)}
        </div>
      )
    }
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2))
      const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <HeadingTag key={key}>{renderInlineNodes(node.content, key)}</HeadingTag>
    }
    case 'paragraph':
      return <p key={key}>{renderInlineNodes(node.content, key)}</p>
    case 'bulletList':
      return (
        <ul key={key}>
          {node.content?.map((child, index) => renderDocumentBlockNode(child, `${key}-li${index}`, context))}
        </ul>
      )
    case 'orderedList':
      return (
        <ol key={key}>
          {node.content?.map((child, index) => renderDocumentBlockNode(child, `${key}-li${index}`, context))}
        </ol>
      )
    case 'listItem':
      return (
        <li key={key}>
          {node.content?.map((child, index) => renderDocumentBlockNode(child, `${key}-c${index}`, context))}
        </li>
      )
    case 'blockquote':
      return (
        <blockquote key={key}>
          {node.content?.map((child, index) => renderDocumentBlockNode(child, `${key}-c${index}`, context))}
        </blockquote>
      )
    case 'horizontalRule':
      return <hr key={key} />
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{documentNodeText(node.content)}</code>
        </pre>
      )
    default:
      return node.content
        ? (
            <Fragment key={key}>
              {node.content.map((child, index) => renderDocumentBlockNode(child, `${key}-c${index}`, context))}
            </Fragment>
          )
        : null
  }
}

function DayDocumentView({
  day,
  locale,
  photoThumbnailSize,
}: {
  day: Pick<ItineraryDay, 'document'>
  locale: string
  photoThumbnailSize: PhotoThumbnailSize
}): ReactElement {
  const { t } = useTranslation('common')
  const nodes = useMemo(() => day.document ?? [], [day.document])

  const hasRenderableContent = useMemo(
    () =>
      nodes.some(
        (node) =>
          node.type === 'activityTile' ||
          node.type === 'sectionBreak' ||
          documentNodeText([node]).trim().length > 0,
      ),
    [nodes],
  )

  if (!hasRenderableContent) {
    return <p className={styles.emptyActivities}>{t('itineraryView.noActivities')}</p>
  }

  return (
    <div className={editorStyles.editorSurface}>
      {nodes.map((node, index) =>
        renderDocumentBlockNode(node, `day-node-${index}`, { locale, photoThumbnailSize }),
      )}
    </div>
  )
}

function VirtualAccommodationCheckoutTile({
  checkout,
  locale,
  onClick,
}: {
  checkout: VirtualAccommodationCheckout
  locale: string
  onClick: (checkout: VirtualAccommodationCheckout) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const checkOutLabel = t('itineraryView.accommodationSummaryCheckOut')
  const checkOutTime = formatLocalTime(checkout.checkOutUntil, locale)
  const renderedCheckOut = checkOutTime || t('itineraryView.accommodationSummaryEmpty')
  const title = `${checkout.accommodationTitle} - ${checkOutLabel}: ${renderedCheckOut}`

  return (
    <button
      type="button"
      className={`${styles.activityCard} ${styles.virtualCheckoutTile}`}
      data-activity-type="accommodation"
      onClick={() => {
        onClick(checkout)
      }}
      aria-label={title}
      title={title}
    >
      <div className={styles.virtualCheckoutBody}>
        <span>
          {checkOutLabel}: <strong>{renderedCheckOut}</strong>
        </span>
      </div>
      <footer className={styles.virtualCheckoutFooter}>
        <span className={styles.activityIcon} aria-hidden="true">
          <BedDouble size={18} />
        </span>
        <span className={styles.activityTitle}>{checkout.accommodationTitle}</span>
      </footer>
    </button>
  )
}

function ActivityCard({
  activity,
  locale,
  photoThumbnailSize,
}: {
  activity: ItineraryActivity
  locale: string
  photoThumbnailSize: PhotoThumbnailSize
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ACTIVITY_TYPE_ICON[activity.type] ?? Sparkles
  const timeRange = formatLocalTimeRange(activity.time, activity.timeEnd, locale)
  const hasAnchoredDate = typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0
  const hasAccommodationSection = hasAccommodationDetails(activity)
  const detailItems = activity.type === 'accommodation' ? [] : toActivityDetailItems(activity, t)
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
    detailItems.length > 0 ||
    Boolean(activity.text?.trim()) ||
    visiblePhotoThumbnails.length > 0 ||
    visibleReferenceChips.length > 0 ||
    visibleLocations.length > 0

  const activityCardClassName = hasBodyContent
    ? styles.activityCard
    : `${styles.activityCard} ${styles.activityCardHeaderOnly}`

  const activityHeaderClassName = hasBodyContent
    ? styles.activityHeader
    : `${styles.activityHeader} ${styles.activityHeaderOnly}`

  return (
    <article
      className={activityCardClassName}
      data-activity-type={activity.type}
      data-activity-id={activity.id}
      data-anchored={hasAnchoredDate ? 'true' : undefined}
    >
      <header className={activityHeaderClassName}>
        <div className={styles.activityHeaderLine}>
          <span className={styles.activityIcon}>
            {hasAnchoredDate ? (
              <span className={styles.anchorIcon} role="img" aria-label={t('itineraryView.anchored')} title={t('itineraryView.anchored')}>
                <Anchor size={18} aria-hidden="true" />
              </span>
            ) : null}
            <Icon size={18} aria-hidden="true" />
          </span>
          <p className={styles.activityTitle}>{activity.title}</p>
          {timeRange ? <span className={styles.activityTime}>{timeRange}</span> : null}
        </div>
      </header>

      {hasAccommodationSection ? (
        <AccommodationDetails activity={activity} locale={locale} />
      ) : null}

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
              {visiblePhotoThumbnails.map(({ reference, index, thumbnailUrl }) => {
                const fullLinkLabel = toReferenceLabel(reference)
                const displayLinkLabel = toDisplayLabel(fullLinkLabel)

                return (
                  <a
                    key={`thumb-${reference.url}-${index}`}
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-no-auto-external-icon="true"
                    className={styles.referenceThumbnailLink}
                    style={{ width: `${thumbnailPreset.widthRem}rem` }}
                    aria-label={t('itineraryView.openReferenceAria', { label: fullLinkLabel })}
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
                data-no-auto-external-icon="true"
                className={referenceChipClassName}
                aria-label={t('itineraryView.openReferenceAria', { label: fullLinkLabel })}
              >
                <ReferenceChipIcon aria-hidden="true" size={12} />
                <span>{displayLinkLabel}</span>
                <ExternalLink aria-hidden="true" size={12} />
              </a>
            )
          })}

          {hiddenReferenceCount > 0 ? (
            <span className={styles.moreChip}>+{hiddenReferenceCount}</span>
          ) : null}
        </div>
      ) : null}

      {visibleLocations.length > 0 ? (
        <div className={`${styles.metaGroup} ${styles.metaGroupLocations}`}>
          {visibleLocations.map((location, index) => {
            const mapUrl = toGoogleMapsUrl({
              coordinates: location.coordinates,
              address: location.address,
            })
            const coordinatesLabel = toCoordinatesLabel(location.coordinates)
            const fullLocationLabel =
              location.caption?.trim() ||
              location.address?.trim() ||
              coordinatesLabel ||
              t('itineraryView.locationFallback')
            const displayLocationLabel = toDisplayLabel(fullLocationLabel)
            const LocationIcon = location.showOnMap ? MapPinned : MapPin

            if (!mapUrl) {
              const locationChipClassName =
                location.showOnMap
                  ? `${styles.metaChip} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
                  : `${styles.metaChip} ${styles.metaLinkLocation}`

              return (
                <span key={`${fullLocationLabel}-${index}`} className={locationChipClassName}>
                  <LocationIcon aria-hidden="true" size={12} />
                  <span>{displayLocationLabel}</span>
                </span>
              )
            }

            const locationLinkClassName =
              location.showOnMap
                ? `${styles.metaLink} ${styles.metaLinkLocation} ${styles.metaLinkMappedLocation}`
                : `${styles.metaLink} ${styles.metaLinkLocation}`

            return (
              <a
                key={`${fullLocationLabel}-${index}`}
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-no-auto-external-icon="true"
                className={locationLinkClassName}
                aria-label={t('itineraryView.openMapAria', { label: fullLocationLabel })}
              >
                <LocationIcon aria-hidden="true" size={12} />
                <span>{displayLocationLabel}</span>
                <ExternalLink aria-hidden="true" size={12} />
              </a>
            )
          })}

          {hiddenLocationCount > 0 ? (
            <span className={styles.moreChip}>+{hiddenLocationCount}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function toActivityDetailItems(
  activity: ItineraryActivity,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const items: string[] = []

  if (activity.type === 'accommodation' && Number.isFinite(activity.details?.nights)) {
    items.push(t('itineraryView.nights', { count: Number(activity.details?.nights) }))
  }

  if (activity.type === 'tour' && activity.details?.guidanceMode) {
    items.push(
      activity.details.guidanceMode === 'guided'
        ? t('itineraryView.guidanceGuided')
        : t('itineraryView.guidanceSelfGuided'),
    )
  }

  if (activity.type === 'food' && activity.details?.cuisine?.trim()) {
    items.push(t('itineraryView.cuisineLabel', { cuisine: activity.details.cuisine.trim() }))
  }

  if (activity.type === 'transfer' && activity.details) {
    const fromLabel = toTransferLocationLabel(activity.details.from)
    const toLabel = toTransferLocationLabel(activity.details.to)
    if (fromLabel) {
      items.push(`${t('itineraryView.transferRouteFrom')}: ${fromLabel}`)
    }
    if (toLabel) {
      items.push(`${t('itineraryView.transferRouteTo')}: ${toLabel}`)
    }
    if (activity.details.mot) {
      items.push(`${t('itineraryView.transferMotLabel')}: ${t(`itineraryView.transferMot.${activity.details.mot}`)}`)
    }
    if (activity.details.estimate?.value?.trim()) {
      items.push(`${t('itineraryView.transferEstimateLabel')}: ${activity.details.estimate.value.trim()}`)
    } else if (activity.details.estimate?.source === 'fallback') {
      items.push(t('itineraryView.transferEstimateUnavailable'))
    }
  }

  return items
}

function toTransferLocationLabel(location?: ItineraryActivity['details'] extends infer Details ? Details extends { from?: infer From } ? From : never : never): string {
  if (!location) {
    return ''
  }

  const caption = location.caption?.trim()
  const address = location.address?.trim()
  const coordinates = Array.isArray(location.coordinates) && location.coordinates.length === 2
    ? `${location.coordinates[0].toFixed(4)}, ${location.coordinates[1].toFixed(4)}`
    : ''

  return caption || address || coordinates
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

function AccommodationDetails({
  activity,
  locale,
}: {
  activity: ItineraryActivity
  locale: string
}): ReactElement | null {
  const { t } = useTranslation('common')

  if (activity.type !== 'accommodation' || !activity.details) {
    return null
  }

  const details = activity.details
  const checkInFrom = formatLocalTime(details.checkInFrom, locale)
  const checkInUntil = formatLocalTime(details.checkInUntil, locale)
  const checkOutUntil = formatLocalTime(details.checkOutUntil, locale)

  const summaryItems = [
    {
      key: 'nights',
      label: t('itineraryView.accommodationSummaryNights'),
      value: Number.isFinite(details.nights) ? String(details.nights) : '',
    },
    {
      key: 'checkIn',
      label: t('itineraryView.accommodationSummaryCheckIn'),
      value: formatTimeWindow(checkInFrom, checkInUntil),
    },
    {
      key: 'checkOut',
      label: t('itineraryView.accommodationSummaryCheckOut'),
      value: checkOutUntil,
    },
  ]

  const rows = [
    numberDetail(t('itineraryView.accommodationFieldGuests'), details.guests),
    textDetail(
      t('itineraryView.accommodationFieldPlatform'),
      details.platform ? t(`itineraryView.platformOptions.${details.platform}`) : undefined,
    ),
    textDetail(t('itineraryView.accommodationFieldContactPhone'), details.contactPhone),
    textDetail(t('itineraryView.accommodationFieldContactEmail'), details.contactEmail),
    textDetail(t('itineraryView.accommodationFieldBookingRef'), details.bookingRef),
  ].filter((row): row is AccommodationDetailRow => row !== null)

  return (
    <details className={styles.accommodationDetails}>
      <summary className={styles.accommodationSummary}>
        {summaryItems.map((item) => (
          <span key={item.key} className={styles.accommodationSummaryItem}>
            <span>{item.label}: </span>
            <strong>{item.value || t('itineraryView.accommodationSummaryEmpty')}</strong>
          </span>
        ))}
      </summary>

      {rows.length > 0 ? (
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

function toStatusClassName(status: OvernightCoverage['status']): 'Covered' | 'Missing' | 'Multiple' {
  if (status === 'covered') {
    return 'Covered'
  }

  if (status === 'multiple') {
    return 'Multiple'
  }

  return 'Missing'
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
