import { ChevronRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItineraryDay } from '@/services/contracts'
import { formatShortMonthDay, formatShortWeekday, getTodayLocalIsoDate } from '@/utils/date-format'

import styles from './DayShortcutsRow.module.css'

interface DayShortcutsRowProps {
  days: ItineraryDay[]
  locale: string
}

interface DayShortcutItem {
  dayNumber: number
  label: string
  isToday: boolean
  isPast: boolean
}

function buildDayShortcutItems(days: ItineraryDay[], locale: string, todayIsoDate: string): DayShortcutItem[] {
  return [...days].sort((left, right) => left.dayNumber - right.dayNumber).map((day) => {
    if (!day.date) {
      return {
        dayNumber: day.dayNumber,
        label: String(day.dayNumber),
        isToday: false,
        isPast: false,
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
    }
  })
}

export function DayShortcutsRow({ days, locale }: DayShortcutsRowProps): ReactElement | null {
  const { t } = useTranslation('common')
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const shortcutsRegionId = useId()
  const dayShortcutItems = useMemo(
    () => buildDayShortcutItems(days, locale, todayIsoDate),
    [days, locale, todayIsoDate],
  )

  if (dayShortcutItems.length <= 1) {
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
            <a
              key={`shortcut-day-${day.dayNumber}`}
              className={[
                styles.dayShortcutChip,
                day.isToday ? styles.dayShortcutChipToday : '',
                day.isPast ? styles.dayShortcutChipPast : '',
              ]
                .filter(Boolean)
                .join(' ')}
              href={`#itinerary-day-${day.dayNumber}`}
              aria-label={t('itineraryView.jumpToDayAria', { dayNumber: day.dayNumber })}
              title={t('itineraryView.jumpToDayAria', { dayNumber: day.dayNumber })}
              aria-current={day.isToday ? 'date' : undefined}
            >
              {day.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
