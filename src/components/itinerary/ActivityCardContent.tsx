import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from '@phosphor-icons/react'

import type { ItineraryActivity } from '@/services/contracts'
import { formatLocalTime, formatLocalTimeRange } from '@/utils/date-format'
import { ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_ICON } from './activity-presentation'
import { ActivityMetadataCompact } from './ActivityMetadataCompact'

interface ActivityCardContentProps {
  activity: ItineraryActivity
  headerLayout?: 'stacked' | 'inline'
  headerLeading?: ReactNode
  headerAction?: ReactNode
  typeDetails?: ReactNode
  anchoredMarker?: ReactNode
  referenceDisplayMode?: 'chips' | 'thumbnails'
  className?: string
  style?: CSSProperties
}

export function ActivityCardContent({
  activity,
  headerLayout = 'stacked',
  headerLeading,
  headerAction,
  typeDetails,
  anchoredMarker,
  referenceDisplayMode = 'chips',
  className = '',
  style,
}: ActivityCardContentProps): ReactElement {
  const { i18n } = useTranslation(['common'])
  const typeColor = ACTIVITY_TYPE_COLOR[activity.type] ?? ACTIVITY_TYPE_COLOR.note
  const rootClassName = `activity-card-content${className ? ` ${className}` : ''}`
  const activityTypeDetails = typeDetails ?? (hasAccommodationDetails(activity) ? (
    <AccommodationDetails activity={activity} />
  ) : undefined)
  const typeIcon = (
    <span className="activity-card-content__type-icon" aria-label={activity.type} style={{ color: typeColor.icon }}>
      {ACTIVITY_TYPE_ICON[activity.type] ?? <Star size={18} />}
    </span>
  )
  const time = activity.time ? (
    <span className="activity-card-content__time">
      {formatLocalTimeRange(activity.time, activity.timeEnd, i18n.language)}
    </span>
  ) : null
  const contentStyle = {
    ...style,
    '--activity-card-header-bg': `${typeColor.icon}10`,
  } as CSSProperties

  return (
    <div className={rootClassName} style={contentStyle}>
      <header className="activity-card-content__header">
        {headerLayout === 'inline' ? (
          <>
            <div className="activity-card-content__header-line activity-card-content__header-line--inline">
              {typeIcon}
              <span className="activity-card-content__title">{activity.title}</span>
              {time}
            </div>
            {anchoredMarker ? (
              <div className="activity-card-content__header-note">
                {anchoredMarker}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="activity-card-content__header-line">
              <span className="activity-card-content__leading" aria-hidden={!headerLeading}>
                {headerLeading}
              </span>
              <span className="activity-card-content__title">{activity.title}</span>
              {time}
            </div>

            <div className="activity-card-content__tool-line">
              {typeIcon}
              <span className="activity-card-content__tool-spacer" />
              {anchoredMarker}
              {headerAction}
            </div>
          </>
        )}
      </header>

      {activityTypeDetails ? (
        <section className="activity-card-content__type-details">
          {activityTypeDetails}
        </section>
      ) : null}

      {activity.text ? (
        <section className="activity-card-content__description">
          {activity.text}
        </section>
      ) : null}

      <ActivityMetadataCompact
        activity={activity}
        className="activity-card-content__meta"
        referenceDisplayMode={referenceDisplayMode}
      />
    </div>
  )
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

function AccommodationDetails({ activity }: { activity: ItineraryActivity }): ReactElement | null {
  const { t, i18n } = useTranslation(['common'])

  if (activity.type !== 'accommodation' || !activity.details) {
    return null
  }

  const details = activity.details
  const checkInFrom = formatLocalTime(details.checkInFrom, i18n.language)
  const checkInUntil = formatLocalTime(details.checkInUntil, i18n.language)
  const checkOutUntil = formatLocalTime(details.checkOutUntil, i18n.language)
  const summaryItems = [
    {
      key: 'nights',
      label: t('common:itinerary.dayEditor.accommodationSummaryNights'),
      value: Number.isFinite(details.nights) ? String(details.nights) : '',
    },
    {
      key: 'checkIn',
      label: t('common:itinerary.dayEditor.accommodationSummaryCheckIn'),
      value: formatTimeWindow(checkInFrom, checkInUntil),
    },
    {
      key: 'checkOut',
      label: t('common:itinerary.dayEditor.accommodationSummaryCheckOut'),
      value: checkOutUntil,
    },
  ]
  const rows = [
    numberDetail(t('common:itinerary.dayEditor.fieldGuests'), details.guests),
    textDetail(
      t('common:itinerary.dayEditor.fieldPlatform'),
      details.platform ? t(`common:itinerary.dayEditor.platformOptions.${details.platform}`) : undefined,
    ),
    textDetail(t('common:itinerary.dayEditor.fieldContactPhone'), details.contactPhone),
    textDetail(t('common:itinerary.dayEditor.fieldContactEmail'), details.contactEmail),
    textDetail(t('common:itinerary.dayEditor.fieldBookingRef'), details.bookingRef),
  ].filter((row): row is AccommodationDetailRow => row !== null)

  return (
    <details
      className="activity-accommodation-details"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary className="activity-accommodation-details__summary">
        {summaryItems.map((item) => (
          <span key={item.key} className="activity-accommodation-details__summary-item">
            <span>{item.label}: </span>
            <strong>{item.value || t('common:itinerary.dayEditor.accommodationSummaryEmpty')}</strong>
          </span>
        ))}
      </summary>
      {rows.length > 0 ? (
        <dl className="activity-accommodation-details__grid">
          {rows.map((row) => (
            <div key={row.label} className="activity-accommodation-details__row">
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
