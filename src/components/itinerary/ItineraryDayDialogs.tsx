import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DialogShell } from '@/components/common/DialogShell'
import { Button } from '@/components/ui/button'
import type { DeleteItineraryDayMode } from '@/services/itinerary-service'
import type { ItineraryDay } from '@/services/contracts'
import { formatLocalDate } from '@/utils/date-format'
import { toDayActivities } from '@/utils/tiptap-compatibility'

import styles from './ItineraryDayDialogs.module.css'

interface InsertDayDialogProps {
  dayDateLabel: string
  summary: string
  busy: boolean
  errorMessage?: string | null
  onSummaryChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function InsertDayDialog({
  dayDateLabel,
  summary,
  busy,
  errorMessage,
  onSummaryChange,
  onCancel,
  onConfirm,
}: InsertDayDialogProps): ReactElement {
  const { t } = useTranslation('common')

  return (
    <DialogShell
      title={t('itineraryView.dayManagement.insertTitle')}
      onClose={onCancel}
      className={styles.modal}
      footer={(
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {t('itineraryView.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? t('itineraryView.dayManagement.saving') : t('itineraryView.dayManagement.insertConfirm')}
          </Button>
        </>
      )}
    >
      <div className={styles.body}>
        <p className={styles.message}>
          {t('itineraryView.dayManagement.insertDateMessage', { date: dayDateLabel })}
        </p>

        <label className={styles.field}>
          <span>{t('itineraryView.dayManagement.insertSummaryLabel')}</span>
          <input
            type="text"
            className={styles.input}
            value={summary}
            onChange={(event) => onSummaryChange(event.target.value)}
            placeholder={t('itineraryView.dayManagement.insertSummaryPlaceholder')}
            maxLength={300}
            disabled={busy}
            autoFocus
          />
        </label>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      </div>
    </DialogShell>
  )
}

interface DeleteDayDialogProps {
  day: ItineraryDay
  days: ItineraryDay[]
  mode: DeleteItineraryDayMode
  targetDayNumber?: number
  busy: boolean
  errorMessage?: string | null
  onModeChange: (mode: DeleteItineraryDayMode) => void
  onTargetDayNumberChange: (targetDayNumber: number | undefined) => void
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteDayDialog({
  day,
  days,
  mode,
  targetDayNumber,
  busy,
  errorMessage,
  onModeChange,
  onTargetDayNumberChange,
  onCancel,
  onConfirm,
}: DeleteDayDialogProps): ReactElement {
  const { t, i18n } = useTranslation('common')

  const activities = useMemo(() => toDayActivities(day), [day])
  const targetDays = useMemo(
    () => days.filter((candidate) => candidate.dayNumber !== day.dayNumber),
    [day.dayNumber, days],
  )

  const hasActivities = activities.length > 0
  const dayLabel = t('itineraryView.dayNumber', { dayNumber: day.dayNumber })
  const dateLabel = day.date ? formatLocalDate(day.date, i18n.language) : dayLabel
  const sourceDateLabel = day.date ? formatLocalDate(day.date, i18n.language) : dayLabel
  const moveDisabled = targetDays.length === 0 || !hasActivities
  const benchDisabled = !hasActivities
  const confirmDisabled =
    busy || (mode === 'move' && targetDayNumber === undefined) || (mode === 'bench' && benchDisabled)
  const confirmLabel =
    mode === 'bench'
      ? t('itineraryView.dayManagement.benchConfirm')
      : mode === 'move'
        ? t('itineraryView.dayManagement.moveConfirm')
        : t('itineraryView.dayManagement.deleteConfirm')

  return (
    <DialogShell
      title={t('itineraryView.dayManagement.deleteTitle', { label: dateLabel })}
      onClose={onCancel}
      className={styles.modal}
      footer={(
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {t('itineraryView.cancel')}
          </Button>
          <Button
            type="button"
            variant={mode === 'delete' ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {busy ? t('itineraryView.dayManagement.saving') : confirmLabel}
          </Button>
        </>
      )}
    >
      <div className={styles.body}>
        {hasActivities ? (
          <div className={styles.choiceList}>
            <label className={styles.choice}>
              <input
                type="radio"
                name="delete-day-mode"
                value="delete"
                checked={mode === 'delete'}
                onChange={() => onModeChange('delete')}
                disabled={busy}
              />
              <span>{t('itineraryView.dayManagement.modeDelete')}</span>
            </label>

            <label className={styles.choice}>
              <input
                type="radio"
                name="delete-day-mode"
                value="bench"
                checked={mode === 'bench'}
                onChange={() => onModeChange('bench')}
                disabled={busy || benchDisabled}
              />
              <span>{t('itineraryView.dayManagement.modeBench')}</span>
            </label>

            {mode === 'bench' ? (
              <p className={styles.hint}>
                {t('itineraryView.dayManagement.benchHint', { count: activities.length })}
              </p>
            ) : null}

            <label className={styles.choice}>
              <input
                type="radio"
                name="delete-day-mode"
                value="move"
                checked={mode === 'move'}
                onChange={() => onModeChange('move')}
                disabled={busy || moveDisabled}
              />
              <span>{t('itineraryView.dayManagement.modeMove')}</span>
            </label>
          </div>
        ) : null}

        {hasActivities && mode === 'move' ? (
          <label className={styles.field}>
            <span>{t('itineraryView.dayManagement.moveTargetLabel')}</span>
            <select
              className={styles.input}
              value={targetDayNumber ?? ''}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                onTargetDayNumberChange(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
              }}
              disabled={busy || moveDisabled}
            >
              <option value="">{t('itineraryView.dayManagement.selectTargetDay')}</option>
              {targetDays.map((targetDay) => (
                <option key={targetDay.dayNumber} value={targetDay.dayNumber}>
                  {targetDay.date
                    ? `${t('itineraryView.dayNumber', { dayNumber: targetDay.dayNumber })} — ${formatLocalDate(targetDay.date, i18n.language)}`
                    : t('itineraryView.dayNumber', { dayNumber: targetDay.dayNumber })}
                </option>
              ))}
            </select>
            <span className={styles.note}>
              {t('itineraryView.dayManagement.moveBlockNote', { sourceDate: sourceDateLabel })}
            </span>
          </label>
        ) : null}

        <div className={styles.activities}>
          <p className={styles.activitiesLabel}>{t('itineraryView.dayManagement.activitiesInDay')}</p>
          {hasActivities ? (
            <ul className={styles.activitiesList}>
              {activities.map((activity) => (
                <li key={activity.id}>{activity.title || t('itineraryView.richEditor.titleFallback')}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.activitiesEmpty}>{t('itineraryView.dayManagement.noActivities')}</p>
          )}
        </div>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      </div>
    </DialogShell>
  )
}
