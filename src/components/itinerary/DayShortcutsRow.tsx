import { Anchor, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { Fragment, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItineraryDay } from '@/services/contracts'
import { formatShortMonthDay, formatShortWeekday, getTodayLocalIsoDate } from '@/utils/date-format'
import { dayHasAnchoredActivity, getLastAnchoredDayNumber } from '@/utils/itinerary-anchors'

import styles from './DayShortcutsRow.module.css'

interface DayShortcutsRowProps {
  days: ItineraryDay[]
  locale: string
  editable?: boolean
  /** Insert a new day before this position (1..dayCount+1). */
  onInsertDay?: (beforeDayNumber: number) => void
  onDeleteDay?: (dayNumber: number) => void
}

interface DayShortcutItem {
  dayNumber: number
  label: string
  isToday: boolean
  isPast: boolean
  hasAnchored: boolean
}

function buildDayShortcutItems(days: ItineraryDay[], locale: string, todayIsoDate: string): DayShortcutItem[] {
  return [...days].sort((left, right) => left.dayNumber - right.dayNumber).map((day) => {
    const hasAnchored = dayHasAnchoredActivity(day)

    if (!day.date) {
      return {
        dayNumber: day.dayNumber,
        label: String(day.dayNumber),
        isToday: false,
        isPast: false,
        hasAnchored,
      }
    }

    const shortWeekday = formatShortWeekday(day.date, locale)
    const monthDayRaw = formatShortMonthDay(day.date, locale)
    const monthDay = locale.startsWith('en') ? monthDayRaw.replace(' ', ', ') : monthDayRaw
    const isToday = day.date === todayIsoDate
    const isPast = day.date < todayIsoDate

    return {
      dayNumber: day.dayNumber,
      label: `${day.dayNumber} - ${shortWeekday} - ${monthDay}`,
      isToday,
      isPast,
      hasAnchored,
    }
  })
}

export function DayShortcutsRow({
  days,
  locale,
  editable = false,
  onInsertDay,
  onDeleteDay,
}: DayShortcutsRowProps): ReactElement | null {
  const { t } = useTranslation('common')
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const shortcutsRegionId = useId()
  const dayShortcutItems = useMemo(
    () => buildDayShortcutItems(days, locale, todayIsoDate),
    [days, locale, todayIsoDate],
  )

  // Two independent guards gate every add/remove control:
  //  1. Anchor rule — insert before day P / delete day D shift dates of day P
  //     (or later), silently re-dating anchored activities. Safe only when the
  //     pivot is strictly after the last anchored day; the backend 409s otherwise.
  //  2. Past rule — never add or remove days in the past. A day is editable only
  //     when it is in the future (neither today nor past); the end (+) only needs
  //     the trip to not already be over, so it can extend a trip ending today.
  const lastAnchoredDayNumber = useMemo(() => getLastAnchoredDayNumber(days), [days])
  const showEditControls = editable && Boolean(onInsertDay) && Boolean(onDeleteDay)
  const dayCount = dayShortcutItems.length
  const lastDayItem = dayShortcutItems[dayCount - 1]
  const isFutureDay = (item: DayShortcutItem): boolean => !item.isToday && !item.isPast
  // Inserting before a future day takes that day's (future) date; deleting a
  // future day removes a future date — both honour the past rule.
  const canInsertBeforeDay = (item: DayShortcutItem): boolean =>
    item.dayNumber > lastAnchoredDayNumber && isFutureDay(item)
  const canDeleteDay = (item: DayShortcutItem): boolean =>
    item.dayNumber > lastAnchoredDayNumber && isFutureDay(item)
  // End insert appends after the last day (last date + 1), which is in the
  // future as long as the trip is not already entirely in the past.
  const canInsertAtEnd =
    dayCount + 1 > lastAnchoredDayNumber && (lastDayItem === undefined || !lastDayItem.isPast)

  if (dayCount === 0) {
    return null
  }

  if (!showEditControls && dayCount <= 1) {
    return null
  }

  return (
    <div className={styles.dayShortcuts}>
      <button
        type="button"
        className={styles.dayShortcutsToggle}
        onClick={() => setIsCollapsed((previousValue) => !previousValue)}
        aria-expanded={!isCollapsed}
        aria-controls={shortcutsRegionId}
        aria-label={
          isCollapsed
            ? t('itineraryView.expandDayShortcutsAria')
            : t('itineraryView.collapseDayShortcutsAria')
        }
      >
        <ChevronRight
          size={15}
          className={`${styles.dayShortcutsToggleIcon}${!isCollapsed ? ` ${styles.dayShortcutsToggleIconExpanded}` : ''}`}
          aria-hidden="true"
        />
        <span className={styles.dayShortcutsLabel}>{t('itineraryView.dayShortcutsLabel')}</span>
      </button>

      {!isCollapsed ? (
        <div id={shortcutsRegionId} className={styles.dayShortcutsRow}>
          {dayShortcutItems.map((day) => (
            <Fragment key={`shortcut-day-${day.dayNumber}`}>
              {showEditControls && canInsertBeforeDay(day) ? (
                <button
                  type="button"
                  className={styles.dayInsertButton}
                  onClick={() => onInsertDay?.(day.dayNumber)}
                  aria-label={t('itineraryView.dayManagement.insertBeforeAria', { dayNumber: day.dayNumber })}
                  title={t('itineraryView.dayManagement.insertBeforeAria', { dayNumber: day.dayNumber })}
                >
                  <Plus size={13} aria-hidden="true" />
                </button>
              ) : null}

              <span
                className={[
                  styles.dayShortcutChip,
                  day.isToday ? styles.dayShortcutChipToday : '',
                  day.isPast ? styles.dayShortcutChipPast : '',
                  showEditControls && canDeleteDay(day) ? styles.dayShortcutChipDeletable : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={day.isToday ? 'date' : undefined}
              >
                {day.hasAnchored ? (
                  <Anchor
                    size={15}
                    className={styles.dayShortcutChipAnchor}
                    aria-label={t('itineraryView.dayManagement.hasAnchoredAria')}
                  />
                ) : null}
                <a
                  className={styles.dayShortcutChipLink}
                  href={`#itinerary-day-${day.dayNumber}`}
                  aria-label={t('itineraryView.jumpToDayAria', { dayNumber: day.dayNumber })}
                  title={t('itineraryView.jumpToDayAria', { dayNumber: day.dayNumber })}
                >
                  {day.label}
                </a>
                {showEditControls && canDeleteDay(day) ? (
                  <button
                    type="button"
                    className={styles.dayDeleteButton}
                    onClick={() => onDeleteDay?.(day.dayNumber)}
                    aria-label={t('itineraryView.dayManagement.deleteAria', { dayNumber: day.dayNumber })}
                    title={t('itineraryView.dayManagement.deleteAria', { dayNumber: day.dayNumber })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </span>
            </Fragment>
          ))}

          {showEditControls && canInsertAtEnd ? (
            <button
              type="button"
              className={styles.dayInsertButton}
              onClick={() => onInsertDay?.(dayCount + 1)}
              aria-label={t('itineraryView.dayManagement.insertEndAria')}
              title={t('itineraryView.dayManagement.insertEndAria')}
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
