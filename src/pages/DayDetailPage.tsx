import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EditableField } from '@/components/EditableField'
import { DayEditorShell } from '@/components/itinerary/DayEditorShell'
import { ActivityFormPanel } from '@/components/itinerary/ActivityFormPanel'
import type { ActivityFormSavePayload } from '@/components/itinerary/ActivityFormPanel'
import { ApiError } from '@/services/contracts'
import { getItinerary, updateItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail, ItineraryActivity, ItineraryActivityInput, ItineraryDay, UpdateItineraryRequest } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { isAnchoredByDefault } from '@/utils/activity-classification'
import { sectionKey } from '@/utils/day-edit-transforms'
import { PencilSimple } from '@phosphor-icons/react'
import { useDayEditStore } from '@/store/day-edit-store'

export function DayDetailPage(): ReactElement {
  const { itineraryId, dayNumber: dayNumberParam } = useParams<{ itineraryId: string; dayNumber: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found' | 'day-not-found'>('loading')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDaySummary, setPendingDaySummary] = useState<string | null>(null)

  // Form panel state
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [addToBlockKey, setAddToBlockKey] = useState<string | null>(null)

  const loadDay = useDayEditStore((state) => state.loadDay)
  const applyServerState = useDayEditStore((state) => state.applyServerState)
  const getFlatActivities = useDayEditStore((state) => state.getFlatActivities)
  const sections = useDayEditStore((state) => state.sections)
  const reorderInBlock = useDayEditStore((state) => state.reorderInBlock)
  const addActivity = useDayEditStore((state) => state.addActivity)
  const addActivityAsNewBlock = useDayEditStore((state) => state.addActivityAsNewBlock)
  const removeActivity = useDayEditStore((state) => state.removeActivity)
  const updateActivityInStore = useDayEditStore((state) => state.editActivity)
  const editDividerLabel = useDayEditStore((state) => state.editDividerLabel)
  const moveBetweenBlocks = useDayEditStore((state) => state.moveBetweenBlocks)
  const splitBlock = useDayEditStore((state) => state.splitBlock)
  const latestSaveRequestIdRef = useRef(0)

  const hasValidDayNumberParam = typeof dayNumberParam === 'string' && /^\d+$/.test(dayNumberParam)
  const dayNum = hasValidDayNumberParam ? parseInt(dayNumberParam, 10) : NaN

  const day = useMemo<ItineraryDay | null>(() => {
    if (!itinerary || isNaN(dayNum)) return null
    return itinerary.days.find((d) => d.dayNumber === dayNum) ?? null
  }, [itinerary, dayNum])

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!itineraryId) {
      setState('not-found')
      return
    }

    if (!hasValidDayNumberParam) {
      setState('not-found')
      return
    }

    setState('loading')
    setSaveError(null)
    setPendingDaySummary(null)

    try {
      const payload = await getItinerary(itineraryId)
      setItinerary(payload)

      const dayExists = payload.days.some((d) => d.dayNumber === dayNum)

      if (!dayExists) {
        setState('day-not-found')
        return
      }

      loadDay(payload, dayNum)
      setState('ready')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState('not-found')
        return
      }

      setState('error')
    }
  }, [itineraryId, hasValidDayNumberParam, dayNum, loadDay])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDetail()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [loadDetail])

  const persistDay = useCallback(async (options?: { summary?: string | undefined; useSummaryOverride?: boolean }): Promise<void> => {
    if (!itinerary || !itineraryId) return

    setSaveError(null)
    const requestId = ++latestSaveRequestIdRef.current

    try {
      const flatActivities = getFlatActivities()
      const currentSummary = options?.useSummaryOverride
        ? options.summary
        : pendingDaySummary !== null
          ? (pendingDaySummary || undefined)
          : day?.summary
      const updatedDays: UpdateItineraryRequest['days'] = itinerary.days.map((d) => ({
        dayNumber: d.dayNumber,
        summary: d.dayNumber === dayNum ? currentSummary : d.summary,
        activities: d.dayNumber === dayNum
          ? flatActivities.map(toActivityInput)
          : d.activities.map(toActivityInput),
      }))

      const updated = await updateItinerary(itineraryId, { days: updatedDays })
      if (requestId !== latestSaveRequestIdRef.current) {
        return
      }

      setItinerary(updated)
      setPendingDaySummary(null)

      const updatedDay = updated.days.find((d) => d.dayNumber === dayNum)
      if (updatedDay) {
        applyServerState(updatedDay)
      }
    } catch {
      if (requestId !== latestSaveRequestIdRef.current) {
        return
      }

      setSaveError(t('common:itinerary.dayEditor.saveFailed'))
    }
  }, [itinerary, itineraryId, dayNum, day?.summary, pendingDaySummary, getFlatActivities, applyServerState, t])

  const handleActivityEdit = useCallback((activityId: string): void => {
    setEditingActivityId(activityId)
    setFormMode('edit')
    setAddToBlockKey(null)
  }, [])

  const handleActivityDelete = useCallback((activityId: string): void => {
    removeActivity(activityId)
    if (editingActivityId === activityId) {
      setFormMode(null)
      setEditingActivityId(null)
    }
    void persistDay()
  }, [removeActivity, editingActivityId, persistDay])

  const handleActivityAdd = useCallback((blockKey: string): void => {
    setAddToBlockKey(blockKey)
    setFormMode('create')
    setEditingActivityId(null)
  }, [])

  const handleBreakBlock = useCallback((blockKey: string): void => {
    splitBlock(blockKey)
    void persistDay()
  }, [splitBlock, persistDay])

  const handleDividerEdit = useCallback((blockKey: string, newLabel: string): void => {
    editDividerLabel(blockKey, newLabel)
    void persistDay()
  }, [editDividerLabel, persistDay])

  // DnD sensors for between-block activity movement
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over) return

    const activityId = active.data.current?.activityId as string | undefined
    const sourceBlockKey = active.data.current?.sourceBlockKey as string | undefined
    if (!activityId || !sourceBlockKey) return

    const targetBlockKey = over.data.current?.targetBlockKey as string | undefined
    const targetPosition = over.data.current?.targetPosition as number | undefined
    if (targetBlockKey === undefined || targetPosition === undefined) return

    if (sourceBlockKey === targetBlockKey) {
      // Same block — find the activity's current index for reorder
      const section = sections.find((s) => sectionKey(s) === sourceBlockKey)
      if (!section) return
      const oldIndex = section.activities.findIndex((a) => a.id === activityId)
      if (oldIndex === -1) return
      const adjustedPos = targetPosition > oldIndex ? targetPosition - 1 : targetPosition
      if (adjustedPos !== oldIndex) {
        reorderInBlock(sourceBlockKey, oldIndex, adjustedPos)
      }
    } else {
      moveBetweenBlocks(activityId, targetBlockKey, targetPosition)
    }
    void persistDay()
  }, [sections, reorderInBlock, moveBetweenBlocks, persistDay])

  const handleFormSave = useCallback(({ activity, createOwnBlock, dividerTitle }: ActivityFormSavePayload): void => {
    if (formMode === 'create' && addToBlockKey) {
      if (createOwnBlock) {
        addActivityAsNewBlock(addToBlockKey, activity, dividerTitle)
      } else {
        addActivity(addToBlockKey, activity)
      }
    } else if (formMode === 'edit') {
      updateActivityInStore(activity)
    }
    setFormMode(null)
    setEditingActivityId(null)
    setAddToBlockKey(null)
    void persistDay()
  }, [formMode, addToBlockKey, addActivity, addActivityAsNewBlock, updateActivityInStore, persistDay])

  const handleFormCancel = useCallback((): void => {
    setFormMode(null)
    setEditingActivityId(null)
    setAddToBlockKey(null)
  }, [])

  const handleNavigateAway = useCallback((to: string): void => {
    navigate(to)
  }, [navigate])

  // Find the activity being edited
  const editingActivity = useMemo<ItineraryActivity | undefined>(() => {
    if (!editingActivityId) return undefined
    for (const section of sections) {
      const found = section.activities.find((a) => a.id === editingActivityId)
      if (found) return found
    }
    return undefined
  }, [editingActivityId, sections])

  if (state === 'loading') {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <p>{t('common:itinerary.detailLoading')}</p>
        </section>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <h1>{t('common:itinerary.detailLoadErrorTitle')}</h1>
          <p>{t('common:itinerary.detailLoadErrorMessage')}</p>
          <div className="button-row">
            <button type="button" onClick={() => void loadDetail()}>
              {t('common:itinerary.retry')}
            </button>
            <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
          </div>
        </section>
      </main>
    )
  }

  if (state === 'day-not-found' && itinerary) {
    return (
      <main className="app-shell">
        <Header />
        <Breadcrumb
          items={[
            { icon: 'home', to: '/', ariaLabel: t('common:itinerary.backToDashboard') },
            { label: itinerary.title, to: `/itineraries/${itinerary.id}` },
          ]}
        />
        <section className="panel">
          <p>{t('common:itinerary.dayEditor.dayNotFound')}</p>
          <Link to={`/itineraries/${itinerary.id}`}>{t('common:back')}</Link>
        </section>
      </main>
    )
  }

  if (state === 'not-found' || !itinerary || !day) {
    return (
      <main className="app-shell">
        <Header />
        <section className="panel">
          <h1>{t('common:itinerary.notFoundTitle')}</h1>
          <p>{t('common:itinerary.notFoundMessage')}</p>
          <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb
        items={[
          { icon: 'home', to: '/', ariaLabel: t('common:itinerary.backToDashboard') },
          {
            label: itinerary.title,
            onClick: () => handleNavigateAway(`/itineraries/${itinerary.id}`),
          },
          { label: t('common:itinerary.dayNumber', { dayNumber: day.dayNumber }) },
        ]}
      />
      <section className="panel day-detail-panel">
        <div className="day-detail-panel__top-actions">
          <DayPanelCloseButton
            ariaLabel={t('common:back')}
            onClick={() => handleNavigateAway(`/itineraries/${itinerary.id}`)}
          />
        </div>
        <h1 className="day-detail-panel__heading">
          {day.date ? formatWeekday(day.date, i18n.language) : '—'}{' '}
          {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
        </h1>

        {saveError ? (
          <div className="button-row" role="alert">
            <p>{saveError}</p>
            <button type="button" onClick={() => void persistDay()}>
              {t('common:itinerary.retry')}
            </button>
          </div>
        ) : null}

        {/* Day summary — inline edit, saves immediately */}
        <EditableField
          value={pendingDaySummary ?? day.summary ?? ''}
          onSave={async (v) => {
            setPendingDaySummary(v)
            await persistDay({ summary: v || undefined, useSummaryOverride: true })
          }}
          renderDisplay={(val, onEdit) => (
            <div className="editable-display">
              <p className="day-detail-panel__summary">{val || <em className="text-muted">{t('common:itinerary.dayEditor.summaryPlaceholder')}</em>}</p>
              <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.dayEditor.summaryPlaceholder')}>
                <PencilSimple size={14} />
              </button>
            </div>
          )}
          renderEditor={(val, onChange, onSave, onCancel, saving) => (
            <div className="editable-editor">
              <textarea
                className="editable-input editable-input--description"
                value={val}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancel()
                }}
                disabled={saving}
                rows={2}
                autoFocus
              />
              <div className="editable-actions">
                <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
              </div>
            </div>
          )}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <DayEditorShell
            sections={sections}
            onActivityEdit={handleActivityEdit}
            onActivityDelete={handleActivityDelete}
            onActivityAdd={handleActivityAdd}
            onBreakBlock={handleBreakBlock}
            onDividerEdit={handleDividerEdit}
          />
        </DndContext>

        {formMode && (
          <ActivityFormPanel
            activity={formMode === 'edit' ? editingActivity : undefined}
            mode={formMode}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        )}

        <div className="day-detail-panel__bottom-actions">
          <DayPanelCloseButton
            ariaLabel={t('common:back')}
            onClick={() => handleNavigateAway(`/itineraries/${itinerary.id}`)}
          />
        </div>
      </section>
    </main>
  )
}

function toActivityInput(activity: ItineraryActivity): ItineraryActivityInput {
  const { isAnchored, ...rest } = activity

  if (isAnchored === isAnchoredByDefault(activity.type)) {
    return rest as ItineraryActivityInput
  }

  return {
    ...(rest as ItineraryActivityInput),
    isAnchored,
  }
}

function DayPanelCloseButton({ ariaLabel, onClick }: { ariaLabel: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      className="panel-close-button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
    >
      <CloseIcon />
    </button>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

