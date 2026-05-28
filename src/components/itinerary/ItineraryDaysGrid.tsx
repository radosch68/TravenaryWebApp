import {
  BedDouble,
  BusFront,
  Camera,
  Car,
  ChevronRight,
  ExternalLink,
  Film,
  Footprints,
  Map,
  Link2,
  MapPin,
  MapPinned,
  MoonStar,
  NotebookPen,
  Plane,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { DayRichTextEditor, type DayRichTextSaveState } from '@/components/itinerary/DayRichTextEditor'
import type { ActivityType, ItineraryActivity, ItineraryDay, WebReference } from '@/services/contracts'
import { hasCoordinates } from '@/components/itinerary/location-map-pins'
import { formatLocalDate, formatLocalTime, formatLocalTimeRange, formatWeekday } from '@/utils/date-format'
import { getOvernightCoverageByGapDay, groupDayForView, type OvernightCoverage } from '@/utils/itinerary-grouping'
import { toDayActivities } from '@/utils/tiptap-compatibility'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from './ItineraryDaysGrid.module.css'

interface ItineraryDaysGridProps {
  days: ItineraryDay[]
  locale: string
  editable?: boolean
  fullBleedOnMobile?: boolean
  buildDayMapRoute?: (dayNumber: number) => string | null
  collapseCommandToken?: number
  collapseCommandMode?: 'collapse-all' | 'expand-all'
  onCollapseStateChange?: (state: { allCollapsed: boolean; allExpanded: boolean }) => void
  onDaySave?: (day: Omit<ItineraryDay, 'date'>) => Promise<void>
}

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

const MAX_VISIBLE_REFERENCES = 3
const MAX_VISIBLE_LOCATIONS = 3
const DAY_SAVE_SUCCESS_FLASH_MS = 1000
const TWO_COLUMN_BREAKPOINT_REM = 64
const THREE_COLUMN_BREAKPOINT_REM = 96
const MIN_COLUMN_RATIO = 0.3
const DEFAULT_TWO_COLUMN_RATIOS: [number, number] = [0.5, 0.5]
const DEFAULT_THREE_COLUMN_RATIOS: [number, number, number] = [1 / 3, 1 / 3, 1 / 3]

type DaySaveVisualState = 'success' | 'error'
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

export function ItineraryDaysGrid({
  days,
  locale,
  editable = false,
  fullBleedOnMobile = false,
  buildDayMapRoute,
  collapseCommandToken,
  collapseCommandMode,
  onCollapseStateChange,
  onDaySave,
}: ItineraryDaysGridProps): ReactElement {
  const { t } = useTranslation('common')
  const gridRef = useRef<HTMLElement | null>(null)
  const activeDividerDragRef = useRef<ActiveDividerDrag | null>(null)
  const todayIsoDate = useMemo(() => {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const sortedDays = useMemo(
    () => [...days].sort((left, right) => left.dayNumber - right.dayNumber),
    [days],
  )
  const overnightCoverageByGapDay = useMemo(
    () => getOvernightCoverageByGapDay(sortedDays),
    [sortedDays],
  )
  const [collapsedDayNumbers, setCollapsedDayNumbers] = useState<Set<number>>(() => new Set())
  const [daySaveVisualStates, setDaySaveVisualStates] = useState<globalThis.Map<number, DaySaveVisualState>>(
    () => new globalThis.Map(),
  )
  const dayHeaderObserversRef = useRef<globalThis.Map<number, ResizeObserver>>(
    new globalThis.Map<number, ResizeObserver>(),
  )
  const saveSuccessTimersRef = useRef<globalThis.Map<number, number>>(new globalThis.Map())
  const [isPointerCoarse, setIsPointerCoarse] = useState(false)
  const [desktopColumnCount, setDesktopColumnCount] = useState<1 | 2 | 3>(1)
  const [gridWidthPx, setGridWidthPx] = useState(0)
  const [gridGapPx, setGridGapPx] = useState(12)
  const [twoColumnRatios, setTwoColumnRatios] = useState<[number, number]>(DEFAULT_TWO_COLUMN_RATIOS)
  const [threeColumnRatios, setThreeColumnRatios] = useState<[number, number, number]>(DEFAULT_THREE_COLUMN_RATIOS)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)

  useEffect(() => {
    const dayNumbers = new Set(sortedDays.map((day) => day.dayNumber))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedDayNumbers((previousValue) => {
      const nextValue = new Set<number>()
      previousValue.forEach((dayNumber) => {
        if (dayNumbers.has(dayNumber)) {
          nextValue.add(dayNumber)
        }
      })
      return nextValue.size === previousValue.size ? previousValue : nextValue
    })
  }, [sortedDays])

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
      setCollapsedDayNumbers(new Set(sortedDays.map((day) => day.dayNumber)))
      return
    }

    setCollapsedDayNumbers(new Set())
  }, [collapseCommandMode, collapseCommandToken, sortedDays])

  useEffect(() => {
    const totalDays = sortedDays.length
    const collapsedCount = collapsedDayNumbers.size
    const allExpanded = collapsedCount === 0
    const allCollapsed = totalDays > 0 && collapsedCount === totalDays

    onCollapseStateChange?.({ allCollapsed, allExpanded })
  }, [collapsedDayNumbers, onCollapseStateChange, sortedDays])

  const toggleDayCollapsed = useCallback((dayNumber: number): void => {
    setCollapsedDayNumbers((previousValue) => {
      const nextValue = new Set(previousValue)
      if (nextValue.has(dayNumber)) {
        nextValue.delete(dayNumber)
      } else {
        nextValue.add(dayNumber)
      }
      return nextValue
    })
  }, [])

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
      setDaySaveVisualStates((previousValue) => {
        const nextValue = new globalThis.Map(previousValue)
        nextValue.set(dayNumber, 'error')
        return nextValue
      })
      return
    }

    if (state === 'dirty' || state === 'saving') {
      setDaySaveVisualStates((previousValue) => {
        if (previousValue.get(dayNumber) !== 'error') {
          return previousValue
        }

        const nextValue = new globalThis.Map(previousValue)
        nextValue.delete(dayNumber)
        return nextValue
      })
      return
    }

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
      aria-label={t('itineraryView.daysAriaLabel')}
    >
      {sortedDays.map((day, index) => {
        const isCollapsed = collapsedDayNumbers.has(day.dayNumber)
        const coverage =
            index < sortedDays.length - 1
              ? overnightCoverageByGapDay.get(day.dayNumber) ?? { status: 'missing' }
            : null
        const dayMapRoute = buildDayMapRoute?.(day.dayNumber) ?? null
        const dayActivities = toDayActivities(day)
        const hasDayMapLocations = hasMappableLocations(dayActivities)
        const isToday = day.date === todayIsoDate
        const saveVisualState = daySaveVisualStates.get(day.dayNumber)
        const dayCardClassName = [
          styles.dayCard,
          isToday ? styles.dayCardToday : '',
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
            >
              <button
                type="button"
                className={styles.dayToggleButton}
                onClick={() => toggleDayCollapsed(day.dayNumber)}
                aria-expanded={!isCollapsed}
                aria-controls={`itinerary-day-content-${day.dayNumber}`}
                aria-label={
                  isCollapsed
                    ? t('itineraryView.expandDayAria', { dayNumber: day.dayNumber })
                    : t('itineraryView.collapseDayAria', { dayNumber: day.dayNumber })
                }
              >
                <ChevronRight
                  size={19}
                  className={`${styles.dayToggleIcon}${!isCollapsed ? ` ${styles.dayToggleIconExpanded}` : ''}`}
                  aria-hidden="true"
                />
              </button>
              <div className={styles.dayHeaderMain}>
                <p className={styles.dayNumber}>{day.dayNumber}</p>
                <div className={styles.dayDateStack}>
                  <p className={styles.dayWeekday}>
                    {day.date ? formatWeekday(day.date, locale) : '—'}
                  </p>
                  <p className={styles.dayDate}>
                    {day.date ? formatLocalDate(day.date, locale) : t('itineraryView.missingDate')}
                  </p>
                </div>
              </div>

              {hasDayMapLocations && dayMapRoute ? (
                <div className={styles.dayHeaderActions}>
                  <Link
                    className={styles.dayMapLauncher}
                    to={dayMapRoute}
                    aria-label={t('itineraryView.openDailyMapAria', { dayNumber: day.dayNumber })}
                    title={t('itineraryView.openDailyMapAria', { dayNumber: day.dayNumber })}
                  >
                    <Map size={17} aria-hidden="true" />
                    <span>{t('itineraryView.dailyMap')}</span>
                  </Link>
                </div>
              ) : null}
            </header>

            {!isCollapsed ? (
              <div id={`itinerary-day-content-${day.dayNumber}`}>
                {editable && onDaySave ? (
                  <DayRichTextEditor
                    day={day}
                    locale={locale}
                    onDaySave={onDaySave}
                    onSaveStateChange={(state) => setDaySaveVisualState(day.dayNumber, state)}
                  />
                ) : (
                  <>
                    {day.summary ? <p className={styles.daySummary}>{day.summary}</p> : null}
                    <DayActivitySections day={day} locale={locale} />
                  </>
                )}

                {coverage ? <OvernightBanner coverage={coverage} /> : null}
              </div>
            ) : null}
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

function OvernightBanner({ coverage }: { coverage: OvernightCoverage }): ReactElement {
  const { t } = useTranslation('common')

  const bannerLabel =
    coverage.status === 'covered'
      ? coverage.accommodationTitle
      : coverage.status === 'multiple'
        ? t('itineraryView.overnightMultiple', { count: coverage.count ?? 2 })
        : t('itineraryView.overnightMissing')

  return (
    <div
      className={`${styles.overnightBanner} ${styles[`overnightBanner${toStatusClassName(coverage.status)}`]}`}
      aria-label={bannerLabel}
      title={bannerLabel}
    >
      <MoonStar aria-hidden="true" size={14} />
      <span className={styles.overnightLabel}>{bannerLabel}</span>
    </div>
  )
}

function DayActivitySections({
  day,
  locale,
}: {
  day: Pick<ItineraryDay, 'document'>
  locale: string
}): ReactElement {
  const { t } = useTranslation('common')

  const sections = useMemo(
    () => groupDayForView(day),
    [day],
  )

  if (sections.length === 0) {
    return <p className={styles.emptyActivities}>{t('itineraryView.noActivities')}</p>
  }

  return (
    <div className={styles.sectionList}>
      {sections.map((section) => (
        <section key={`section-${section.blockIndex}`} className={styles.sectionCard}>
          {section.dividerLabel ? (
            <div className={styles.sectionDivider}>
              <span className={styles.sectionDividerLabel}>{section.dividerLabel}</span>
            </div>
          ) : null}

          <ul className={styles.activityList}>
            {section.activities.map((activity) => (
              <li key={activity.id}>
                <ActivityCard activity={activity} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ActivityCard({
  activity,
  locale,
}: {
  activity: ItineraryActivity
  locale: string
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ACTIVITY_ICONS[activity.type] ?? Sparkles
  const timeRange = formatLocalTimeRange(activity.time, activity.timeEnd, locale)
  const hasAnchoredDate = typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0
  const hasAccommodationSection = hasAccommodationDetails(activity)
  const detailItems = activity.type === 'accommodation' ? [] : toActivityDetailItems(activity, t)

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

  const activityCardClassName = hasBodyContent
    ? styles.activityCard
    : `${styles.activityCard} ${styles.activityCardHeaderOnly}`

  const activityHeaderClassName = hasBodyContent
    ? styles.activityHeader
    : `${styles.activityHeader} ${styles.activityHeaderOnly}`

  return (
    <article className={activityCardClassName} data-activity-type={activity.type}>
      <header className={activityHeaderClassName}>
        <div className={styles.activityHeaderLine}>
          <span className={styles.activityIcon} aria-hidden="true">
            <Icon size={18} />
          </span>
          <p className={styles.activityTitle}>{activity.title}</p>
          {timeRange ? <span className={styles.activityTime}>{timeRange}</span> : null}
        </div>

        {hasAnchoredDate ? (
          <div className={styles.activityHeaderNote}>
            <span className={styles.anchoredChip}>{t('itineraryView.anchored')}</span>
          </div>
        ) : null}
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
