import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ItineraryDay } from '@/services/contracts'
import { parseIsoDate } from '@/utils/date-format'

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

function getTodayIsoDate(): string {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDayShortcutItems(days: ItineraryDay[], locale: string, todayIsoDate: string): DayShortcutItem[] {
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const monthDayFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })

  return [...days].sort((left, right) => left.dayNumber - right.dayNumber).map((day) => {
    if (!day.date) {
      return {
        dayNumber: day.dayNumber,
        label: String(day.dayNumber),
        isToday: false,
        isPast: false,
      }
    }

    const parsedDate = parseIsoDate(day.date)
    const shortWeekday = weekdayFormatter.format(parsedDate)
    const monthDayRaw = monthDayFormatter.format(parsedDate)
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
  const todayIsoDate = useMemo(() => getTodayIsoDate(), [])
  const dayShortcutItems = useMemo(
    () => buildDayShortcutItems(days, locale, todayIsoDate),
    [days, locale, todayIsoDate],
  )

  if (dayShortcutItems.length <= 1) {
    return null
  }

  return (
    <div className={styles.dayShortcuts}>
      <p className={styles.dayShortcutsLabel}>{t('itineraryView.dayShortcutsLabel')}</p>
      <div className={styles.dayShortcutsRow}>
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
    </div>
  )
}
