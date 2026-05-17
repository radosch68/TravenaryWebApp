import type { FormEvent, ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/contracts'
import { createManualItinerary } from '@/services/itinerary-service'

import styles from './ManualItineraryStartPage.module.css'

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_MANUAL_DAY_COUNT = 365

function parseIsoDateToUtcEpoch(value: string): number | null {
  if (!ISO_DATE_REGEX.test(value)) {
    return null
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number.parseInt(yearRaw, 10)
  const month = Number.parseInt(monthRaw, 10)
  const day = Number.parseInt(dayRaw, 10)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  const epoch = Date.UTC(year, month - 1, day)
  const parsed = new Date(epoch)
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null
  }

  return epoch
}

function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultManualDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date()
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dateFrom = formatLocalDateInput(todayNormalized)
  const dateToDate = new Date(todayNormalized)
  dateToDate.setDate(dateToDate.getDate() + 2)
  const dateTo = formatLocalDateInput(dateToDate)
  return { dateFrom, dateTo }
}

function deriveManualDayCount(dateFrom: string, dateTo: string): number | null {
  const fromEpoch = parseIsoDateToUtcEpoch(dateFrom)
  const toEpoch = parseIsoDateToUtcEpoch(dateTo)

  if (fromEpoch === null || toEpoch === null || toEpoch < fromEpoch) {
    return null
  }

  return Math.floor((toEpoch - fromEpoch) / DAY_MS) + 1
}

function buildManualDays(
  dateFrom: string,
  dateTo: string,
): Array<{ dayNumber: number; activities: Array<never> }> | undefined {
  if (!dateFrom) {
    return undefined
  }

  if (!dateTo) {
    return [{ dayNumber: 1, activities: [] }]
  }

  const dayCount = deriveManualDayCount(dateFrom, dateTo)
  if (!dayCount || dayCount < 1) {
    return undefined
  }

  return Array.from({ length: dayCount }, (_, index) => ({
    dayNumber: index + 1,
    activities: [],
  }))
}

export function ManualItineraryStartPage(): ReactElement {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const defaultDates = useMemo(() => createDefaultManualDateRange(), [])
  const [manualTitle, setManualTitle] = useState('')
  const [manualDateFrom, setManualDateFrom] = useState(defaultDates.dateFrom)
  const [manualDateTo, setManualDateTo] = useState(defaultDates.dateTo)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const manualDayCount = useMemo(
    () => deriveManualDayCount(manualDateFrom, manualDateTo),
    [manualDateFrom, manualDateTo],
  )

  const manualDateRequiredError = !manualDateFrom || !manualDateTo
    ? t('dashboardManualStart.dateRequired')
    : null

  const manualDateRangeError = manualDateFrom && manualDateTo && manualDateTo < manualDateFrom
    ? t('dashboardManualStart.dateRangeError')
    : null

  const manualDayCountLimitError = (manualDayCount ?? 0) > MAX_MANUAL_DAY_COUNT
    ? t('dashboardManualStart.dayCountLimitError', { count: MAX_MANUAL_DAY_COUNT })
    : null

  const inlineError = manualDateRequiredError ?? manualDateRangeError ?? manualDayCountLimitError ?? errorMessage

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (manualDateRequiredError || manualDateRangeError || manualDayCountLimitError) {
      setErrorMessage(manualDateRequiredError ?? manualDateRangeError ?? manualDayCountLimitError)
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    const fallbackTitle = t('dashboardManualStart.titleFallback')
    const title = manualTitle.trim() || fallbackTitle
    const days = buildManualDays(manualDateFrom, manualDateTo)

    try {
      const created = await createManualItinerary({
        title,
        startDate: manualDateFrom,
        ...(days ? { days } : {}),
      })

      navigate(`/itineraries/${created.id}`)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.message.trim().length > 0) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(t('dashboardManualStart.submitError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div>
            <p className={styles.kicker}>{t('dashboardManualStart.kicker')}</p>
            <h1 className={styles.title}>{t('dashboardManualStart.title')}</h1>
            <p className={styles.subtitle}>{t('dashboardManualStart.subtitle')}</p>
          </div>
          <div className={styles.headerActions}>
            <Button asChild variant="outline" size="sm">
              <Link to="/itineraries">{t('dashboardManualStart.backToItineraries')}</Link>
            </Button>
          </div>
        </section>

        <form className={styles.formCard} onSubmit={(event) => {
          void onSubmit(event)
        }}>
          <label className={styles.fieldWide}>
            <span>{t('dashboardManualStart.titleLabel')}</span>
            <input
              type="text"
              className={styles.fieldInput}
              value={manualTitle}
              onChange={(event) => {
                setManualTitle(event.target.value)
                setErrorMessage(null)
              }}
              placeholder={t('dashboardManualStart.titlePlaceholder')}
              maxLength={140}
              disabled={isSubmitting}
            />
          </label>

          <div className={styles.dateGrid}>
            <label className={styles.field}>
              <span>{t('dashboardManualStart.dateFromLabel')}</span>
              <input
                type="date"
                className={styles.fieldInput}
                value={manualDateFrom}
                onChange={(event) => {
                  const nextDateFrom = event.target.value
                  setManualDateFrom(nextDateFrom)
                  setErrorMessage(null)

                  if (nextDateFrom && manualDateTo && manualDateTo < nextDateFrom) {
                    setManualDateTo(nextDateFrom)
                  }
                }}
                disabled={isSubmitting}
              />
            </label>

            <label className={styles.field}>
              <span>{t('dashboardManualStart.dateToLabel')}</span>
              <input
                type="date"
                className={styles.fieldInput}
                value={manualDateTo}
                onChange={(event) => {
                  setManualDateTo(event.target.value)
                  setErrorMessage(null)
                }}
                min={manualDateFrom || undefined}
                disabled={isSubmitting}
              />
            </label>
          </div>

          {manualDayCount ? (
            <p className={styles.hint}>{t('dashboardManualStart.dayCount', { count: manualDayCount })}</p>
          ) : null}

          {inlineError ? <p className={styles.errorText}>{inlineError}</p> : null}

          <div className={styles.footerActions}>
            <Button type="submit" disabled={isSubmitting || manualDateRequiredError !== null || manualDateRangeError !== null || manualDayCountLimitError !== null}>
              {isSubmitting ? t('dashboardManualStart.creating') : t('dashboardManualStart.create')}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
