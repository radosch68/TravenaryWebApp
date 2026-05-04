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
import { DialogShell } from '@/components/DialogShell'
import { PanelCloseButton } from '@/components/PanelCloseButton'
import { DayEditorShell } from '@/components/itinerary/DayEditorShell'
import { ActivityBenchPanel } from '@/components/itinerary/ActivityBenchPanel'
import { ActivityFormPanel } from '@/components/itinerary/ActivityFormPanel'
import type { ActivityFormSavePayload } from '@/components/itinerary/ActivityFormPanel'
import { ActivityTypePicker } from '@/components/itinerary/ActivityTypePicker'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { buildLocationMapPinsFromActivities } from '@/components/itinerary/location-map-pins'
import type { LocationMapPin } from '@/components/itinerary/location-map-pins'
import { ApiError } from '@/services/contracts'
import { getItinerary, updateItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail, ItineraryActivity, ItineraryActivityInput, ItineraryDay, UpdateItineraryRequest, ActivityType } from '@/services/contracts'
import type { ErrorDetail } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { isActivityAnchored } from '@/utils/activity-classification'
import { sectionKey } from '@/utils/day-edit-transforms'
import { PencilSimple } from '@phosphor-icons/react'
import { useDayEditStore } from '@/store/day-edit-store'
import { useAuthStore } from '@/store/auth-store'

export function DayDetailPage(): ReactElement {
  const { itineraryId, dayNumber: dayNumberParam } = useParams<{ itineraryId: string; dayNumber: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])
  const clearSession = useAuthStore((authState) => authState.clearSession)

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found' | 'day-not-found'>('loading')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState<ItineraryActivity | null>(null)
  const [pendingDaySummary, setPendingDaySummary] = useState<string | null>(null)

  // Form panel state
  const [formMode, setFormMode] = useState<'pick-type' | 'create' | 'edit' | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [addToBlockKey, setAddToBlockKey] = useState<string | null>(null)
  const [createActivityType, setCreateActivityType] = useState<ActivityType>('note')
  const [createOwnBlock, setCreateOwnBlock] = useState(false)
  const [createBlockDividerTitle, setCreateBlockDividerTitle] = useState('')

  const loadDay = useDayEditStore((state) => state.loadDay)
  const applyServerState = useDayEditStore((state) => state.applyServerState)
  const getFlatActivities = useDayEditStore((state) => state.getFlatActivities)
  const sections = useDayEditStore((state) => state.sections)
  const reorderInBlock = useDayEditStore((state) => state.reorderInBlock)
  const addActivity = useDayEditStore((state) => state.addActivity)
  const addActivityAsNewBlock = useDayEditStore((state) => state.addActivityAsNewBlock)
  const addActivityAsStandaloneBlock = useDayEditStore((state) => state.addActivityAsStandaloneBlock)
  const removeActivity = useDayEditStore((state) => state.removeActivity)
  const updateActivityInStore = useDayEditStore((state) => state.editActivity)
  const editDividerLabel = useDayEditStore((state) => state.editDividerLabel)
  const moveBetweenBlocks = useDayEditStore((state) => state.moveBetweenBlocks)
  const moveToNewBlock = useDayEditStore((state) => state.moveToNewBlock)
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
    setMoveError(null)
    setPendingDeleteActivity(null)
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

      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        navigate('/signin', { replace: true })
        return
      }

      setState('error')
    }
  }, [clearSession, dayNum, hasValidDayNumberParam, itineraryId, loadDay, navigate])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDetail()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [loadDetail])

  const persistDay = useCallback(async (options?: {
    summary?: string | undefined
    useSummaryOverride?: boolean
    activityBenchOverride?: ItineraryActivity[]
    suppressSaveError?: boolean
  }): Promise<{ message: string; details?: ErrorDetail[] } | null> => {
    if (!itinerary || !itineraryId) return null

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
      const activityBench = (options?.activityBenchOverride ?? itinerary.activityBench ?? []).map(toActivityInput)

      const updated = await updateItinerary(itineraryId, { days: updatedDays, activityBench })
      if (requestId !== latestSaveRequestIdRef.current) {
        return null
      }

      setItinerary(updated)
      setPendingDaySummary(null)

      const updatedDay = updated.days.find((d) => d.dayNumber === dayNum)
      if (updatedDay) {
        applyServerState(updatedDay)
      }
      return null
    } catch (error) {
      if (requestId !== latestSaveRequestIdRef.current) {
        return null
      }

      let message = t('common:itinerary.dayEditor.saveFailed')
      let details: ErrorDetail[] | undefined
      if (error instanceof ApiError) {
        const firstDetail = error.details?.[0]?.message
        message = firstDetail ?? error.message ?? message
        details = error.details
      }

      if (!options?.suppressSaveError) {
        setSaveError(message)
      }

      return { message, details }
    }
  }, [itinerary, itineraryId, dayNum, day, pendingDaySummary, getFlatActivities, applyServerState, t])

  const handleActivityEdit = useCallback((activityId: string): void => {
    setEditingActivityId(activityId)
    setFormMode('edit')
    setAddToBlockKey(null)
  }, [])

  const handleActivityDelete = useCallback((activityId: string): void => {
    setMoveError(null)
    const activity = sections
      .flatMap((section) => section.activities)
      .find((item) => item.id === activityId)

    if (!activity) {
      return
    }

    setPendingDeleteActivity(activity)
  }, [sections])

  const handleActivityAdd = useCallback((blockKey: string): void => {
    setMoveError(null)
    setAddToBlockKey(blockKey)
    setFormMode('pick-type')
    setEditingActivityId(null)
  }, [])

  const handleTypeSelected = useCallback((type: ActivityType, ownBlock: boolean, dividerTitle: string): void => {
    setCreateActivityType(type)
    setCreateOwnBlock(ownBlock)
    setCreateBlockDividerTitle(dividerTitle)
    setFormMode('create')
  }, [])

  const handleBreakBlock = useCallback((blockKey: string): void => {
    setMoveError(null)
    splitBlock(blockKey)
    void persistDay()
  }, [splitBlock, persistDay])

  const handleDividerEdit = useCallback((blockKey: string, newLabel: string): void => {
    setMoveError(null)
    editDividerLabel(blockKey, newLabel)
    void persistDay()
  }, [editDividerLabel, persistDay])

  const tailBlockKey = useMemo(() => (
    sections.length > 0 ? sectionKey(sections[sections.length - 1]) : 'flex-0'
  ), [sections])

  const moveDayActivityToBench = useCallback((activity: ItineraryActivity): void => {
    if (!itinerary) {
      return
    }

    setMoveError(null)
    if (isActivityAnchored(activity)) {
      setMoveError(t('common:itinerary.dayEditor.activityBench.anchoredMoveBlocked'))
      return
    }

    const nextBench: ItineraryActivity[] = [
      ...(itinerary.activityBench ?? []),
      { ...activity, anchorDate: null },
    ]

    removeActivity(activity.id)
    setItinerary((prev) => (prev ? { ...prev, activityBench: nextBench } : prev))
    void persistDay({ activityBenchOverride: nextBench })
  }, [itinerary, removeActivity, persistDay, t])

  const moveBenchActivityToCurrentDay = useCallback((
    activityId: string,
    options?: { targetBlockKey?: string; targetPosition?: number; targetNewBlockIndex?: number },
  ): void => {
    if (!itinerary) {
      return
    }

    const benchActivity = itinerary.activityBench.find((item) => item.id === activityId)
    if (!benchActivity) {
      return
    }

    setMoveError(null)
    if (typeof options?.targetNewBlockIndex === 'number') {
      addActivityAsStandaloneBlock({ ...benchActivity, anchorDate: null }, options.targetNewBlockIndex)
    } else {
      const targetBlockKey = options?.targetBlockKey ?? tailBlockKey
      const hasTargetBlock = sections.some((section) => sectionKey(section) === targetBlockKey)

      if (hasTargetBlock) {
        addActivity(targetBlockKey, { ...benchActivity, anchorDate: null }, options?.targetPosition)
      } else {
        addActivityAsStandaloneBlock({ ...benchActivity, anchorDate: null }, sections.length)
      }
    }

    const nextBench = itinerary.activityBench.filter((item) => item.id !== activityId)
    setItinerary((prev) => (prev ? { ...prev, activityBench: nextBench } : prev))
    void persistDay({ activityBenchOverride: nextBench })
  }, [addActivity, addActivityAsStandaloneBlock, itinerary, persistDay, sections, tailBlockKey])

  const moveDayActivityToNewBlock = useCallback((activityId: string, targetBlockIndex: number): void => {
    setMoveError(null)
    moveToNewBlock(activityId, targetBlockIndex)
    void persistDay()
  }, [moveToNewBlock, persistDay])

  const handleDeleteDialogClose = useCallback((): void => {
    setPendingDeleteActivity(null)
  }, [])

  const handleDeleteConfirm = useCallback((): void => {
    if (!pendingDeleteActivity) {
      return
    }

    removeActivity(pendingDeleteActivity.id)
    if (editingActivityId === pendingDeleteActivity.id) {
      setFormMode(null)
      setEditingActivityId(null)
    }
    setPendingDeleteActivity(null)
    void persistDay()
  }, [editingActivityId, pendingDeleteActivity, persistDay, removeActivity])

  const handleMoveToBenchConfirm = useCallback((): void => {
    if (!pendingDeleteActivity) {
      return
    }

    const activity = pendingDeleteActivity
    if (editingActivityId === activity.id) {
      setFormMode(null)
      setEditingActivityId(null)
    }
    setPendingDeleteActivity(null)
    moveDayActivityToBench(activity)
  }, [editingActivityId, moveDayActivityToBench, pendingDeleteActivity])

  // DnD sensors for between-block activity movement
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over) return

    const activityId = active.data.current?.activityId as string | undefined
    const sourceSurface = (active.data.current?.sourceSurface as 'day' | 'bench' | undefined) ?? 'day'
    const sourceBlockKey = active.data.current?.sourceBlockKey as string | undefined
    if (!activityId) return

    const targetSurface = over.data.current?.targetSurface as 'day' | 'bench' | undefined
    if (!targetSurface) return

    if (targetSurface === 'bench') {
      if (sourceSurface !== 'day') {
        return
      }

      const sourceSection = sections.find((section) => section.activities.some((activity) => activity.id === activityId))
      const activity = sourceSection?.activities.find((item) => item.id === activityId)
      if (!activity) {
        return
      }
      moveDayActivityToBench(activity)
      return
    }

    const targetNewBlockIndex = over.data.current?.targetNewBlockIndex as number | undefined
    if (typeof targetNewBlockIndex === 'number') {
      if (sourceSurface === 'bench') {
        moveBenchActivityToCurrentDay(activityId, { targetNewBlockIndex })
      } else {
        moveDayActivityToNewBlock(activityId, targetNewBlockIndex)
      }
      return
    }

    const targetBlockKey = over.data.current?.targetBlockKey as string | undefined
    const targetPosition = over.data.current?.targetPosition as number | undefined
    if (targetBlockKey === undefined || targetPosition === undefined) return

    if (sourceSurface === 'bench') {
      moveBenchActivityToCurrentDay(activityId, { targetBlockKey, targetPosition })
      return
    }

    if (!sourceBlockKey) return

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
  }, [sections, moveDayActivityToBench, moveBenchActivityToCurrentDay, moveDayActivityToNewBlock, reorderInBlock, moveBetweenBlocks, persistDay])

  const handleFormSave = useCallback(async ({ activity, createOwnBlock, dividerTitle }: ActivityFormSavePayload): Promise<void> => {
    setMoveError(null)
    setSaveError(null)
    if (formMode === 'create' && addToBlockKey) {
      if (createOwnBlock) {
        addActivityAsNewBlock(addToBlockKey, activity, dividerTitle)
      } else {
        addActivity(addToBlockKey, activity)
      }
    } else if (formMode === 'edit') {
      updateActivityInStore(activity)
    }

    const saveErrorResult = await persistDay({ suppressSaveError: true })
    if (saveErrorResult) {
      if (day) {
        applyServerState(day)
      }
      throw new Error(saveErrorResult.message, { cause: saveErrorResult.details })
    }

    setFormMode(null)
    setEditingActivityId(null)
    setAddToBlockKey(null)
  }, [formMode, addToBlockKey, addActivity, addActivityAsNewBlock, updateActivityInStore, persistDay, day, applyServerState])

  const handleFormCancel = useCallback((): void => {
    setFormMode(null)
    setEditingActivityId(null)
    setAddToBlockKey(null)
  }, [])

  const handleNavigateAway = useCallback((to: string): void => {
    navigate(to)
  }, [navigate])

  const dayMapPins = useMemo<LocationMapPin[]>(() => {
    const activities = sections.flatMap((section) => section.activities)
    return buildLocationMapPinsFromActivities(activities, {
      getActivityTypeLabel: (activityType) => t(`common:itinerary.dayEditor.activityTypeOptions.${activityType}`),
    })
  }, [sections, t])

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

  const dayTitle = day.date
    ? `${formatWeekday(day.date, i18n.language)} ${formatLocalDate(day.date, i18n.language)}`
    : `— ${t('common:itinerary.missingDate')}`

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
          { label: dayTitle },
        ]}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <section className="panel day-detail-panel">
          <div className="day-detail-panel__top-actions">
            <PanelCloseButton
              ariaLabel={t('common:back')}
              onClick={() => handleNavigateAway(`/itineraries/${itinerary.id}`)}
            />
          </div>
          <h1 className="day-detail-panel__heading">{dayTitle}</h1>

          {saveError ? (
            <div className="button-row" role="alert">
              <p>{saveError}</p>
              <button type="button" onClick={() => void persistDay()}>
                {t('common:itinerary.retry')}
              </button>
            </div>
          ) : null}
          {moveError ? <p className="error" role="alert">{moveError}</p> : null}

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

          <ItineraryMapLauncher
            pins={dayMapPins}
            title={t('common:itinerary.dayEditor.dailyMapTitle')}
            emptyLabel={t('common:itinerary.dayEditor.mapNoMarkedLocations')}
            openLabel={t('common:itinerary.dayEditor.openFullMap')}
            to={`/?mapItineraryId=${encodeURIComponent(itinerary.id)}&mapDayNumber=${encodeURIComponent(String(day.dayNumber))}`}
          />

          <DayEditorShell
            sections={sections}
            onActivityEdit={handleActivityEdit}
            onActivityDelete={handleActivityDelete}
            onActivityAdd={handleActivityAdd}
            onBreakBlock={handleBreakBlock}
            onDividerEdit={handleDividerEdit}
          />

          {formMode === 'pick-type' && (
            <ActivityTypePicker
              onSelect={handleTypeSelected}
              onCancel={handleFormCancel}
            />
          )}

          {(formMode === 'create' || formMode === 'edit') && (
            <ActivityFormPanel
              activity={formMode === 'edit' ? editingActivity : undefined}
              activityType={formMode === 'edit' ? (editingActivity?.type ?? 'note') : createActivityType}
              owningDayDate={day?.date}
              createOwnBlock={formMode === 'create' ? createOwnBlock : undefined}
              blockDividerTitle={formMode === 'create' ? createBlockDividerTitle : undefined}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          )}

          <div className="day-detail-panel__bottom-actions">
            <PanelCloseButton
              ariaLabel={t('common:back')}
              onClick={() => handleNavigateAway(`/itineraries/${itinerary.id}`)}
            />
          </div>
        </section>

        <section className="panel activity-bench-standalone-panel">
          <ActivityBenchPanel
            activityBench={itinerary.activityBench ?? []}
            onMoveToCurrentDay={(activityId) => moveBenchActivityToCurrentDay(activityId)}
          />
        </section>
      </DndContext>

      {pendingDeleteActivity ? (
        <DialogShell
          title={t('common:itinerary.dayEditor.deleteActionDialog.title')}
          onClose={handleDeleteDialogClose}
          footer={(
            <>
              <button type="button" onClick={handleMoveToBenchConfirm}>
                {t('common:itinerary.dayEditor.deleteActionDialog.bench')}
              </button>
              <button type="button" className="button-danger" onClick={handleDeleteConfirm}>
                {t('common:itinerary.dayEditor.deleteActionDialog.delete')}
              </button>
            </>
          )}
        >
          <div className="dialog-message-body">
            <p>{t('common:itinerary.dayEditor.deleteActionDialog.message')}</p>
          </div>
        </DialogShell>
      ) : null}
    </main>
  )
}

function toActivityInput(activity: ItineraryActivity): ItineraryActivityInput {
  if (activity.type !== 'accommodation') {
    return activity
  }

  const details = { ...(activity.details ?? {}), nights: activity.details?.nights ?? 1 }
  const rawContactEmail = typeof details.contactEmail === 'string' ? details.contactEmail.trim() : undefined

  // Legacy data can contain non-email contactEmail values that block saving unrelated day edits.
  if (rawContactEmail) {
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContactEmail)
    if (!looksLikeEmail) {
      delete details.contactEmail
    } else {
      details.contactEmail = rawContactEmail
    }
  } else if (details.contactEmail !== undefined) {
    delete details.contactEmail
  }

  return {
    ...activity,
    details,
  }
}
