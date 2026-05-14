import {
  BedDouble,
  BusFront,
  Camera,
  Car,
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
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { ActivityType, ItineraryActivity, ItineraryDay, WebReference } from '@/services/contracts'
import { hasCoordinates } from '@/components/itinerary/location-map-pins'
import { formatLocalDate, formatLocalTime, formatLocalTimeRange, formatWeekday } from '@/utils/date-format'
import { getOvernightCoverageByGapDay, groupActivitiesForView, type OvernightCoverage } from '@/utils/itinerary-grouping'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from './ItineraryDaysGrid.module.css'

interface ItineraryDaysGridProps {
  days: ItineraryDay[]
  locale: string
  fullBleedOnMobile?: boolean
  buildDayMapRoute?: (dayNumber: number) => string | null
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

export function ItineraryDaysGrid({
  days,
  locale,
  fullBleedOnMobile = false,
  buildDayMapRoute,
}: ItineraryDaysGridProps): ReactElement {
  const { t } = useTranslation('common')
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

  return (
    <section
      className={`${styles.daysGrid}${fullBleedOnMobile ? ` ${styles.fullBleedOnMobile}` : ''}`}
      aria-label={t('itineraryView.daysAriaLabel')}
    >
      {sortedDays.map((day, index) => {
        const coverage =
            index < sortedDays.length - 1
              ? overnightCoverageByGapDay.get(day.dayNumber) ?? { status: 'missing' }
            : null
        const dayMapRoute = buildDayMapRoute?.(day.dayNumber) ?? null
        const hasDayMapLocations = hasMappableLocations(day.activities)
        const isToday = day.date === todayIsoDate
        const dayCardClassName = isToday
          ? `${styles.dayCard} ${styles.dayCardToday}`
          : styles.dayCard

        return (
          <article
            id={`itinerary-day-${day.dayNumber}`}
            key={`itinerary-day-${day.dayNumber}`}
            className={dayCardClassName}
            aria-current={isToday ? 'date' : undefined}
          >
            <header className={styles.dayHeader}>
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
            </header>

            {day.summary ? <p className={styles.daySummary}>{day.summary}</p> : null}

            <DayActivitySections activities={day.activities} locale={locale} />

            {coverage ? <OvernightBanner coverage={coverage} /> : null}
          </article>
        )
      })}
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
  activities,
  locale,
}: {
  activities: ItineraryActivity[]
  locale: string
}): ReactElement {
  const { t } = useTranslation('common')

  const sections = useMemo(
    () => groupActivitiesForView(activities),
    [activities],
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
