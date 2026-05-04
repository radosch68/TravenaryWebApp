import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EditableField } from '@/components/EditableField'
import { PanelCloseButton } from '@/components/PanelCloseButton'
import { ShareButton } from '@/components/ShareButton'
import { ItineraryPlanningView } from '@/components/itinerary/ItineraryPlanningView'
import { ItineraryTimelineView } from '@/components/itinerary/ItineraryTimelineView'
import { ItineraryActivityBenchSummary } from '@/components/itinerary/ItineraryActivityBenchSummary'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { AnchoredShiftConflictDialog, DeleteDayDialog, InsertDayDialog } from '@/components/itinerary/ItineraryDayDialogs'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { ApiError } from '@/services/contracts'
import { deleteItinerary, deleteItineraryDay, getItinerary, insertItineraryDay, updateItinerary } from '@/services/itinerary-service'
import type {
  DeleteItineraryDayMode,
  ItineraryActivity,
  ItineraryActivityInput,
  ItineraryDay,
  UpdateItineraryRequest,
  ItineraryDetail,
} from '@/services/contracts'
import { formatLocalDate } from '@/utils/date-format'
import { toDisplayLabel } from '@/utils/display-label'
import { unsplashUrl } from '@/utils/unsplash-url'
import { PencilSimple } from '@phosphor-icons/react'
import { useAuthStore } from '@/store/auth-store'

type PresentationMode = 'planning' | 'timeline'
const PRESENTATION_MODE_STORAGE_KEY = 'itinerary-detail-presentation-mode'

type AnchoredShiftConflict = {
  dayNumber: number
  dayDate?: string
  activityId: string
  activityTitle: string
  anchorDate: string
}

export function ItineraryDetailPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common', 'errors'])
  const clearSession = useAuthStore((authState) => authState.clearSession)
  const hasRestoredScrollRef = useRef(false)
  const [dashboardReturnUrl, setDashboardReturnUrl] = useState('/?page=1')

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [reorderError, setReorderError] = useState(false)
  const [dateConflictError, setDateConflictError] = useState(false)
  const [presentationMode, setPresentationMode] = useState<PresentationMode>('planning')
  const [insertDayNumber, setInsertDayNumber] = useState<number | null>(null)
  const [insertDaySummary, setInsertDaySummary] = useState('')
  const [insertDayBusy, setInsertDayBusy] = useState(false)
  const [insertDayError, setInsertDayError] = useState<string | null>(null)
  const [deleteDayNumber, setDeleteDayNumber] = useState<number | null>(null)
  const [deleteDayMode, setDeleteDayMode] = useState<DeleteItineraryDayMode>('delete')
  const [deleteTargetDayNumber, setDeleteTargetDayNumber] = useState<number | undefined>(undefined)
  const [deleteDayBusy, setDeleteDayBusy] = useState(false)
  const [deleteDayError, setDeleteDayError] = useState<string | null>(null)
  const [anchoredShiftConflict, setAnchoredShiftConflict] = useState<{
    operation: 'add' | 'remove' | 'date'
    pivotDateLabel?: string
    conflicts: AnchoredShiftConflict[]
  } | null>(null)

  const patchItinerary = useCallback(
    async (data: UpdateItineraryRequest): Promise<void> => {
      if (!itineraryId) return
      const updated = await updateItinerary(itineraryId, data)
      setItinerary(updated)
    },
    [itineraryId],
  )

  const handlePlanningReorder = useCallback(
    (reordered: ItineraryDay[]) => {
      if (!itinerary) return
      const previousDays = itinerary.days
      const daysPayload = buildDayPayload(reordered)
      setReorderError(false)
      setItinerary((prev) => prev ? { ...prev, days: reordered } : prev)
      void patchItinerary({ days: daysPayload }).catch(() => {
        setItinerary((prev) => prev ? { ...prev, days: previousDays } : prev)
        setReorderError(true)
      })
    },
    [itinerary, patchItinerary],
  )

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!itineraryId) {
      setState('not-found')
      return
    }

    setState('loading')
    setDeleteError(false)
    setDeleteConfirmOpen(false)

    try {
      const payload = await getItinerary(itineraryId)
      setItinerary(payload)
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
  }, [clearSession, itineraryId, navigate])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('dashboard-return-url')
      if (saved && saved.startsWith('/')) {
        setDashboardReturnUrl(saved)
      }
    } catch {
      // Ignore storage errors and keep fallback URL.
    }
  }, [])

  useEffect(() => {
    if (!itineraryId || state !== 'ready' || hasRestoredScrollRef.current) {
      return
    }

    const scrollStorageKey = `itinerary-detail-scroll:${itineraryId}`
    let savedScrollY: number | null = null

    try {
      const raw = window.sessionStorage.getItem(scrollStorageKey)
      if (raw !== null) {
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed >= 0) {
          savedScrollY = parsed
        }
      }
    } catch {
      savedScrollY = null
    }

    hasRestoredScrollRef.current = true

    if (savedScrollY === null) {
      return
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY ?? 0, behavior: 'auto' })
      try {
        window.sessionStorage.removeItem(scrollStorageKey)
      } catch {
        // Ignore storage errors after restoration.
      }
    })
  }, [itineraryId, state])

  useEffect(() => {
    if (!itineraryId) {
      setPresentationMode('planning')
      return
    }

    try {
      const raw = window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)
      if (!raw) {
        setPresentationMode('planning')
        return
      }

      const parsed = JSON.parse(raw) as { itineraryId?: unknown; mode?: unknown }
      if (
        parsed.itineraryId === itineraryId
        && (parsed.mode === 'planning' || parsed.mode === 'timeline')
      ) {
        setPresentationMode(parsed.mode)
        return
      }
    } catch {
      // Ignore parse/storage errors and default to planning mode.
    }

    setPresentationMode('planning')
  }, [itineraryId])

  const handleDelete = async (): Promise<void> => {
    if (!itineraryId) {
      return
    }

    setDeleteBusy(true)
    setDeleteError(false)
    try {
      await deleteItinerary(itineraryId)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState('not-found')
      } else {
        setDeleteError(true)
        setDeleteConfirmOpen(true)
      }
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleNavigateBackToDashboard = useCallback((): void => {
    navigate(dashboardReturnUrl)
  }, [dashboardReturnUrl, navigate])

  const handleSetPresentationMode = useCallback((mode: PresentationMode): void => {
    setPresentationMode(mode)

    if (!itineraryId) {
      return
    }

    try {
      window.sessionStorage.setItem(
        PRESENTATION_MODE_STORAGE_KEY,
        JSON.stringify({ itineraryId, mode }),
      )
    } catch {
      // Ignore storage write errors and keep in-memory mode.
    }
  }, [itineraryId])

  const handleOpenDayDetail = useCallback((dayNumber: number): void => {
    if (!itineraryId) {
      return
    }

    const scrollStorageKey = `itinerary-detail-scroll:${itineraryId}`
    try {
      window.sessionStorage.setItem(scrollStorageKey, String(window.scrollY))
    } catch {
      // Ignore storage errors and continue navigation.
    }

    navigate(`/itineraries/${itineraryId}/days/${dayNumber}`)
  }, [itineraryId, navigate])

  const handleOpenInsertDayDialog = useCallback((dayNumber: number): void => {
    if (itinerary) {
      const conflicts = collectAnchoredShiftConflicts(itinerary.days, dayNumber)
      if (conflicts.length > 0) {
        const pivotDateLabel = getPivotDateLabel(itinerary.days, dayNumber, i18n.language, t)
        setAnchoredShiftConflict({
          operation: 'add',
          pivotDateLabel,
          conflicts,
        })
        return
      }
    }

    setInsertDayNumber(dayNumber)
    setInsertDaySummary('')
    setInsertDayError(null)
  }, [i18n.language, itinerary, t])

  const maybeOpenDateShiftConflict = useCallback((nextStartDate: string | null): boolean => {
    if (!itinerary) {
      return false
    }

    const conflicts = collectAnchoredDateChangeConflicts(itinerary.days, itinerary.startDate, nextStartDate)
    if (conflicts.length === 0) {
      return false
    }

    setAnchoredShiftConflict({
      operation: 'date',
      conflicts,
    })
    return true
  }, [itinerary])

  const handleCloseInsertDayDialog = useCallback((): void => {
    if (insertDayBusy) {
      return
    }
    setInsertDayNumber(null)
    setInsertDaySummary('')
    setInsertDayError(null)
  }, [insertDayBusy])

  const handleConfirmInsertDay = useCallback(async (): Promise<void> => {
    if (!itineraryId || insertDayNumber == null) {
      return
    }

    setInsertDayBusy(true)
    setInsertDayError(null)

    try {
      const updated = await insertItineraryDay(itineraryId, {
        dayNumber: insertDayNumber,
        summary: insertDaySummary.trim() || undefined,
      })
      setItinerary(updated)
      setInsertDayNumber(null)
      setInsertDaySummary('')
    } catch (error) {
      if (error instanceof ApiError) {
        setInsertDayError(error.message)
      } else {
        setInsertDayError(t('common:itinerary.days.mutationFailed'))
      }
    } finally {
      setInsertDayBusy(false)
    }
  }, [insertDayNumber, insertDaySummary, itineraryId, t])

  const handleOpenDeleteDayDialog = useCallback((dayNumber: number): void => {
    if (itinerary) {
      const conflicts = collectAnchoredShiftConflicts(itinerary.days, dayNumber)
      if (conflicts.length > 0) {
        const pivotDateLabel = getPivotDateLabel(itinerary.days, dayNumber, i18n.language, t)
        setAnchoredShiftConflict({
          operation: 'remove',
          pivotDateLabel,
          conflicts,
        })
        return
      }
    }

    setDeleteDayNumber(dayNumber)
    setDeleteDayMode('delete')
    setDeleteDayError(null)
    setDeleteDayBusy(false)
    setDeleteTargetDayNumber(undefined)
  }, [i18n.language, itinerary, t])

  const handleCloseDeleteDayDialog = useCallback((): void => {
    if (deleteDayBusy) {
      return
    }
    setDeleteDayNumber(null)
    setDeleteDayMode('delete')
    setDeleteTargetDayNumber(undefined)
    setDeleteDayError(null)
  }, [deleteDayBusy])

  const handleConfirmDeleteDay = useCallback(async (): Promise<void> => {
    if (!itineraryId || deleteDayNumber == null) {
      return
    }

    if (deleteDayMode === 'move' && deleteTargetDayNumber == null) {
      setDeleteDayError(t('common:itinerary.days.selectTargetDay'))
      return
    }

    setDeleteDayBusy(true)
    setDeleteDayError(null)

    try {
      const updated = await deleteItineraryDay(itineraryId, {
        dayNumber: deleteDayNumber,
        mode: deleteDayMode,
        ...(deleteDayMode === 'move' ? { targetDayNumber: deleteTargetDayNumber } : {}),
      })
      setItinerary(updated)
      setDeleteDayNumber(null)
      setDeleteDayMode('delete')
      setDeleteTargetDayNumber(undefined)
    } catch (error) {
      if (error instanceof ApiError) {
        setDeleteDayError(error.message)
      } else {
        setDeleteDayError(t('common:itinerary.days.mutationFailed'))
      }
    } finally {
      setDeleteDayBusy(false)
    }
  }, [deleteDayMode, deleteDayNumber, deleteTargetDayNumber, itineraryId, t])

  const itineraryMapPins = useMemo(() => {
    if (!itinerary) {
      return []
    }

    return buildLocationMapPinsFromDays(itinerary.days, {
      getActivityTypeLabel: (activityType) => t(`common:itinerary.dayEditor.activityTypeOptions.${activityType}`),
    })
  }, [itinerary, t])

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

  if (state === 'not-found') {
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

  if (state === 'error' || !itinerary) {
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

  const selectedDeleteDay = deleteDayNumber != null
    ? itinerary.days.find((item) => item.dayNumber === deleteDayNumber) ?? null
    : null
  const insertDayDateIso = insertDayNumber != null
    ? deriveInsertedDayDateIso(itinerary, insertDayNumber)
    : undefined
  const insertDayDateLabel = insertDayDateIso
    ? formatLocalDate(insertDayDateIso, i18n.language)
    : t('common:itinerary.missingDate')
  const defaultDeleteTargetDayNumber = selectedDeleteDay
    ? itinerary.days.find((candidate) => candidate.dayNumber !== selectedDeleteDay.dayNumber)?.dayNumber
    : undefined
  const resolvedDeleteTargetDayNumber = deleteTargetDayNumber ?? defaultDeleteTargetDayNumber

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb items={[{ icon: 'home', to: dashboardReturnUrl, ariaLabel: t('common:itinerary.backToDashboard') }, { label: itinerary.title }]} />
      <section className="panel itinerary-detail-panel">
        {/* Tags — above cover photo, with edit pencil */}
        <EditableField
          value={itinerary.tags.join(', ')}
          onSave={async (v) => {
            const tags = v
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
            await patchItinerary({ tags })
          }}
          renderDisplay={(_val, onEdit) => (
            <div className="editable-display itinerary-detail-tags-block">
              <div className="itinerary-detail-panel__top-actions">
                <ShareButton
                  itineraryId={itinerary.id}
                  hasShareLink={itinerary.hasShareLink}
                  onShareChange={(has) => setItinerary((prev) => prev ? { ...prev, hasShareLink: has } : prev)}
                />
                <PanelCloseButton ariaLabel={t('common:itinerary.backToDashboard')} onClick={handleNavigateBackToDashboard} />
              </div>
              <div className="itinerary-detail-tags-row">
                {itinerary.tags.length > 0 ? (
                  <div className="itinerary-tags itinerary-tags--detail" aria-label={t('common:itinerary.tagsAriaLabel')}>
                    <svg className="itinerary-tags__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path
                        d="M20 10L13 3H6L3 6V13L10 20L20 10Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="7.8" cy="7.8" r="1.6" fill="currentColor" />
                    </svg>
                    <div className="itinerary-tags__list">
                      {itinerary.tags.map((tag) => (
                        <span key={tag} className="itinerary-tag-chip" title={tag}>{toDisplayLabel(tag)}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted">{t('common:itinerary.edit.tags')}</p>
                )}
                <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.tags')}>
                  <PencilSimple size={14} />
                </button>
              </div>
            </div>
          )}
          renderEditor={(val, onChange, onSave, onCancel, saving) => (
            <div className="editable-editor">
              <input
                type="text"
                className="editable-input"
                value={val}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave()
                  if (e.key === 'Escape') onCancel()
                }}
                placeholder={t('common:itinerary.edit.tagPlaceholder')}
                disabled={saving}
                autoFocus
              />
              <div className="editable-actions">
                <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
              </div>
            </div>
          )}
        />

        {/* Cover photo — with edit pencil overlay */}
        {itinerary.coverPhoto?.url ? (
          <CoverPhotoSection
            coverPhoto={itinerary.coverPhoto}
            title={itinerary.title}
            onSave={(url, caption) => patchItinerary({
              coverPhoto: url ? { url, caption: caption || undefined } : null,
            })}
          />
        ) : (
          <CoverPhotoPlaceholder
            onSave={(url, caption) => patchItinerary({
              coverPhoto: { url, caption: caption || undefined },
            })}
          />
        )}

        {/* Title — click-to-edit */}
        <EditableField
          value={itinerary.title}
          onSave={async (v) => patchItinerary({ title: v })}
          validate={(v) => (v.length === 0 ? t('common:itinerary.edit.titleRequired') : undefined)}
          renderDisplay={(val, onEdit) => (
            <div className="editable-display">
              <h1>{val}</h1>
              <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.titlePlaceholder')}>
                <PencilSimple size={14} />
              </button>
            </div>
          )}
          renderEditor={(val, onChange, onSave, onCancel, saving) => (
            <div className="editable-editor">
              <input
                type="text"
                className="editable-input editable-input--title"
                value={val}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave()
                  if (e.key === 'Escape') onCancel()
                }}
                disabled={saving}
                autoFocus
              />
              <div className="editable-actions">
                <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
              </div>
            </div>
          )}
        />

        {/* Description — click-to-edit */}
        <EditableField
          value={itinerary.description ?? ''}
          onSave={async (v) => patchItinerary({ description: v || undefined })}
          renderDisplay={(val, onEdit) => (
            <div className="editable-display">
              <p className="itinerary-detail-description">{val || <em className="text-muted">{t('common:itinerary.edit.descriptionPlaceholder')}</em>}</p>
              <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.descriptionPlaceholder')}>
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
                rows={3}
                autoFocus
              />
              <div className="editable-actions">
                <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
              </div>
            </div>
          )}
        />

        {/* Dates + day count + presentation toggle — 2-row grid */}
        <div className="itinerary-detail-meta-grid">
          <div className="itinerary-detail-meta-grid__left">
            <EditableField
              value={itinerary.startDate ?? ''}
              onSave={async (v) => {
                setDateConflictError(false)
                const nextStartDate = normalizeOptionalIsoDate(v)
                if (maybeOpenDateShiftConflict(nextStartDate)) {
                  return
                }
                try {
                  await patchItinerary({ startDate: nextStartDate })
                } catch (err) {
                  if (err instanceof ApiError && err.status === 409) {
                    setDateConflictError(true)
                    return
                  }
                  throw err
                }
              }}
              renderDisplay={(val, onEdit) => (
                <span className="editable-display editable-display--inline">
                  <span>{val ? formatLocalDate(val, i18n.language) : t('common:itinerary.missingDate')}</span>
                  <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.startDate')}>
                    <PencilSimple size={14} />
                  </button>
                </span>
              )}
              renderEditor={(val, onChange, onSave, onCancel, saving) => (
                <span className="editable-editor editable-editor--inline-date">
                  <input
                    type="date"
                    className="editable-input editable-input--date"
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSave()
                      if (e.key === 'Escape') onCancel()
                    }}
                    disabled={saving}
                    autoFocus
                  />
                  <span className="editable-actions">
                    <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                    <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
                  </span>
                </span>
              )}
            />
          </div>
          <span className="itinerary-detail-meta-grid__right itinerary-detail-day-count">
            {t('common:itinerary.dayCount', { count: itinerary.days.length })}
          </span>

          <div className="itinerary-detail-meta-grid__left">
            <EditableField
              value={itinerary.endDate ?? ''}
              onSave={async (v) => {
                setDateConflictError(false)
                const dayCount = itinerary.days.length
                const nextStartDate = deriveStartDateFromEndDateInput(v, dayCount)
                if (maybeOpenDateShiftConflict(nextStartDate)) {
                  return
                }
                try {
                  await patchItinerary({ startDate: nextStartDate })
                } catch (err) {
                  if (err instanceof ApiError && err.status === 409) {
                    setDateConflictError(true)
                    return
                  }
                  throw err
                }
              }}
              renderDisplay={(val, onEdit) => (
                <span className="editable-display editable-display--inline">
                  <span>{val ? formatLocalDate(val, i18n.language) : t('common:itinerary.missingDate')}</span>
                  <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.endDate')}>
                    <PencilSimple size={14} />
                  </button>
                </span>
              )}
              renderEditor={(val, onChange, onSave, onCancel, saving) => (
                <span className="editable-editor editable-editor--inline-date">
                  <input
                    type="date"
                    className="editable-input editable-input--date"
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSave()
                      if (e.key === 'Escape') onCancel()
                    }}
                    disabled={saving}
                    autoFocus
                  />
                  <span className="editable-actions">
                    <button type="button" onClick={onSave} disabled={saving} className="editable-btn editable-btn--save">✓</button>
                    <button type="button" onClick={onCancel} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
                  </span>
                </span>
              )}
            />
          </div>
          <div className="itinerary-detail-meta-grid__right">
            <div className="presentation-toggle" role="group" aria-label={t('common:itinerary.presentation.toggleLabel')}>
              <button
                type="button"
                className={`presentation-toggle__btn${presentationMode === 'planning' ? ' presentation-toggle__btn--active' : ''}`}
                onClick={() => handleSetPresentationMode('planning')}
              >
                {t('common:itinerary.presentation.planning')}
              </button>
              <button
                type="button"
                className={`presentation-toggle__btn${presentationMode === 'timeline' ? ' presentation-toggle__btn--active' : ''}`}
                onClick={() => handleSetPresentationMode('timeline')}
              >
                {t('common:itinerary.presentation.timeline')}
              </button>
            </div>
          </div>
        </div>

        <ItineraryMapLauncher
          pins={itineraryMapPins}
          title={t('common:itinerary.dayEditor.itineraryMapTitle')}
          emptyLabel={t('common:itinerary.dayEditor.mapNoMarkedLocations')}
          openLabel={t('common:itinerary.dayEditor.openFullMap')}
          to={`/?mapItineraryId=${encodeURIComponent(itinerary.id)}`}
        />

        <ItineraryActivityBenchSummary activityBench={itinerary.activityBench} />

        {dateConflictError && <p className="error">{t('errors:dateConflict')}</p>}

        {/* Day list — presentation-dependent rendering */}
        {presentationMode === 'planning' ? (
          <ItineraryPlanningView
            itinerary={itinerary}
            onReorder={handlePlanningReorder}
            onInsertDay={handleOpenInsertDayDialog}
            onDeleteDay={handleOpenDeleteDayDialog}
            referenceDisplayMode="thumbnails"
            reorderError={reorderError}
          />
        ) : (
          <ItineraryTimelineView
            itinerary={itinerary}
            onOpenDay={handleOpenDayDetail}
            referenceDisplayMode="thumbnails"
          />
        )}

        {reorderError && presentationMode !== 'planning' ? <p className="error">{t('common:itinerary.edit.saveFailed')}</p> : null}
        {deleteError ? <p className="error">{t('common:itinerary.deleteError')}</p> : null}

        <div className="button-row">
          {deleteConfirmOpen ? (
            <>
              <p className="itinerary-delete-confirm">{t('common:itinerary.deleteConfirm')}</p>
              <div className="button-row button-row--inline">
                <button className="button-danger" type="button" onClick={() => void handleDelete()} disabled={deleteBusy}>
                  {deleteBusy ? t('common:itinerary.deleting') : t('common:itinerary.delete')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setDeleteError(false)
                  }}
                  disabled={deleteBusy}
                >
                  {t('common:cancel')}
                </button>
              </div>
            </>
          ) : (
            <button
              className="button-danger"
              type="button"
              onClick={() => {
                setDeleteConfirmOpen(true)
                setDeleteError(false)
              }}
            >
              {t('common:itinerary.delete')}
            </button>
          )}
        </div>

        <div className="itinerary-detail-panel__bottom-actions">
          <PanelCloseButton ariaLabel={t('common:itinerary.backToDashboard')} onClick={handleNavigateBackToDashboard} />
        </div>
      </section>

      {insertDayNumber != null ? (
        <InsertDayDialog
          dayDateLabel={insertDayDateLabel}
          summary={insertDaySummary}
          busy={insertDayBusy}
          errorMessage={insertDayError}
          onSummaryChange={setInsertDaySummary}
          onCancel={handleCloseInsertDayDialog}
          onConfirm={() => void handleConfirmInsertDay()}
        />
      ) : null}

      {selectedDeleteDay ? (
        <DeleteDayDialog
          day={selectedDeleteDay}
          days={itinerary.days}
          mode={deleteDayMode}
          targetDayNumber={resolvedDeleteTargetDayNumber}
          busy={deleteDayBusy}
          errorMessage={deleteDayError}
          onModeChange={(mode) => {
            setDeleteDayMode(mode)
            if (mode !== 'move') {
              setDeleteTargetDayNumber(undefined)
            } else {
              setDeleteTargetDayNumber((current) => current ?? defaultDeleteTargetDayNumber)
            }
          }}
          onTargetDayNumberChange={setDeleteTargetDayNumber}
          onCancel={handleCloseDeleteDayDialog}
          onConfirm={() => void handleConfirmDeleteDay()}
        />
      ) : null}

      {anchoredShiftConflict ? (
        <AnchoredShiftConflictDialog
          title={
            anchoredShiftConflict.operation === 'add'
              ? t('common:itinerary.days.aaConflictAddTitle', { date: anchoredShiftConflict.pivotDateLabel })
              : anchoredShiftConflict.operation === 'remove'
                ? t('common:itinerary.days.aaConflictDeleteTitle', { date: anchoredShiftConflict.pivotDateLabel })
                : t('common:itinerary.days.aaConflictDateChangeTitle')
          }
          message={t('common:itinerary.days.aaConflictMessage')}
          conflicts={anchoredShiftConflict.conflicts.map((conflict) => ({
            activityId: conflict.activityId,
            activityTitle: conflict.activityTitle,
            anchorDateLabel: formatLocalDate(conflict.anchorDate, i18n.language),
          }))}
          onClose={() => setAnchoredShiftConflict(null)}
        />
      ) : null}
    </main>
  )
}

function buildDayPayload(days: ItineraryDay[]): UpdateItineraryRequest['days'] {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    summary: day.summary,
    activities: day.activities.map(toActivityInput),
  }))
}

function toActivityInput(activity: ItineraryActivity): ItineraryActivityInput {
  return activity
}

function deriveInsertedDayDateIso(itinerary: ItineraryDetail, dayNumber: number): string | undefined {
  if (dayNumber < 1) {
    return undefined
  }

  if (itinerary.startDate) {
    return addIsoDays(itinerary.startDate, dayNumber - 1)
  }

  const dayAtPosition = itinerary.days.find((day) => day.dayNumber === dayNumber)
  if (dayAtPosition?.date) {
    return dayAtPosition.date
  }

  const previousDay = itinerary.days.find((day) => day.dayNumber === dayNumber - 1)
  if (previousDay?.date) {
    return addIsoDays(previousDay.date, 1)
  }

  return undefined
}

function addIsoDays(isoDate: string, deltaDays: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}

function normalizeOptionalIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function deriveDayDateFromStartDate(startDate: string | null, dayNumber: number): string | undefined {
  if (!startDate) {
    return undefined
  }

  return addIsoDays(startDate, dayNumber - 1)
}

function collectAnchoredDateChangeConflicts(
  days: ItineraryDay[],
  currentStartDate: string | undefined,
  nextStartDate: string | null,
): AnchoredShiftConflict[] {
  const normalizedCurrentStartDate = normalizeOptionalIsoDate(currentStartDate)
  const normalizedNextStartDate = normalizeOptionalIsoDate(nextStartDate)
  if (normalizedCurrentStartDate === normalizedNextStartDate) {
    return []
  }

  return days.flatMap((day) => {
    const currentDayDate = deriveDayDateFromStartDate(normalizedCurrentStartDate, day.dayNumber)
    const newDayDate = deriveDayDateFromStartDate(normalizedNextStartDate, day.dayNumber)
    if (currentDayDate === newDayDate) {
      return []
    }

    return day.activities
      .filter((activity) => typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0)
      .map((activity) => ({
        dayNumber: day.dayNumber,
        dayDate: day.date,
        activityId: activity.id,
        activityTitle: activity.title,
        anchorDate: activity.anchorDate as string,
      }))
  })
}

function deriveStartDateFromEndDateInput(endDateValue: string, dayCount: number): string | null {
  const normalizedEndDate = normalizeOptionalIsoDate(endDateValue)
  if (!normalizedEndDate) {
    return null
  }

  if (dayCount <= 1) {
    return normalizedEndDate
  }

  return addIsoDays(normalizedEndDate, -(dayCount - 1))
}

function collectAnchoredShiftConflicts(days: ItineraryDay[], fromDayNumber: number): AnchoredShiftConflict[] {
  return days
    .filter((day) => day.dayNumber >= fromDayNumber)
    .flatMap((day) => day.activities
      .filter((activity) => typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0)
      .map((activity) => ({
        dayNumber: day.dayNumber,
        dayDate: day.date,
        activityId: activity.id,
        activityTitle: activity.title,
        anchorDate: activity.anchorDate as string,
      })))
}

function getPivotDateLabel(
  days: ItineraryDay[],
  dayNumber: number,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const day = days.find((candidate) => candidate.dayNumber === dayNumber)
  if (day?.date) {
    return formatLocalDate(day.date, locale)
  }

  return t('common:itinerary.dayNumber', { dayNumber })
}

/* ---- Cover photo with edit overlay ---- */

interface CoverPhotoSectionProps {
  coverPhoto: { url: string; caption?: string }
  title: string
  onSave: (url: string | null, caption: string) => Promise<void>
}

function CoverPhotoSection({ coverPhoto, title, onSave }: CoverPhotoSectionProps): ReactElement {
  const { t } = useTranslation(['common'])
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(coverPhoto.url)
  const [caption, setCaption] = useState(coverPhoto.caption ?? '')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editing) {
      setUrl(coverPhoto.url)
      setCaption(coverPhoto.caption ?? '')
    }
  }, [coverPhoto, editing])

  useEffect(() => {
    if (!editing) return
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [editing])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await onSave(url.trim() || null, caption.trim())
      setEditing(false)
    } catch {
      /* stay open */
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (): Promise<void> => {
    setSaving(true)
    try {
      await onSave(null, '')
      setEditing(false)
    } catch {
      /* stay open */
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="itinerary-detail-cover itinerary-detail-cover--editing" ref={containerRef}>
        <img
          src={unsplashUrl(coverPhoto.url, 1200, 85)}
          alt={coverPhoto.caption ?? title}
        />
        <div className="cover-edit-form">
          <label className="cover-edit-label">
            {t('common:itinerary.edit.coverPhotoUrlPlaceholder')}
            <input
              type="url"
              className="editable-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </label>
          <label className="cover-edit-label">
            {t('common:itinerary.edit.coverPhotoCaptionPlaceholder')}
            <input
              type="text"
              className="editable-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={saving}
            />
          </label>
          <div className="editable-actions">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="editable-btn editable-btn--save">✓</button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
            <button type="button" onClick={() => void handleRemove()} disabled={saving} className="editable-btn editable-btn--danger">
              {t('common:itinerary.edit.coverPhotoRemove')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="itinerary-detail-cover">
      <img
        src={unsplashUrl(coverPhoto.url, 1200, 85)}
        alt={coverPhoto.caption ?? title}
        title={coverPhoto.caption ?? title}
      />
      <button type="button" className="cover-edit-trigger edit-pencil" onClick={() => setEditing(true)} aria-label={t('common:itinerary.edit.coverPhoto')}>
        <PencilSimple size={14} />
      </button>
      {coverPhoto.caption ? (
        <p className="itinerary-detail-cover__caption">{coverPhoto.caption}</p>
      ) : null}
    </div>
  )
}

function CoverPhotoPlaceholder({ onSave }: { onSave: (url: string, caption: string) => Promise<void> }): ReactElement {
  const { t } = useTranslation(['common'])
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing) return
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false)
        setUrl('')
        setCaption('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [editing])

  const handleSave = async (): Promise<void> => {
    if (!url.trim()) return
    setSaving(true)
    try {
      await onSave(url.trim(), caption.trim())
      setEditing(false)
    } catch {
      /* stay open */
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="cover-add-placeholder cover-add-placeholder--hero"
        onClick={() => setEditing(true)}
        aria-label={t('common:itinerary.edit.coverPhoto')}
      >
        <svg
          className="cover-add-placeholder__icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M3 18L9 12L13 16L17 12L21 16V20H3V18Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 20V6C3 4.9 3.9 4 5 4H19C20.1 4 21 4.9 21 6V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="cover-add-placeholder__label">{t('common:itinerary.edit.coverPhoto')}</span>
        <span className="cover-add-placeholder__edit" aria-hidden="true">
          <PencilSimple size={14} />
        </span>
      </button>
    )
  }

  return (
    <div className="cover-edit-form cover-edit-form--standalone" ref={containerRef}>
      <label className="cover-edit-label">
        {t('common:itinerary.edit.coverPhotoUrlPlaceholder')}
        <input type="url" className="editable-input" value={url} onChange={(e) => setUrl(e.target.value)} disabled={saving} autoFocus />
      </label>
      <label className="cover-edit-label">
        {t('common:itinerary.edit.coverPhotoCaptionPlaceholder')}
        <input type="text" className="editable-input" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={saving} />
      </label>
      <div className="editable-actions">
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="editable-btn editable-btn--save">✓</button>
        <button type="button" onClick={() => { setEditing(false); setUrl(''); setCaption('') }} disabled={saving} className="editable-btn editable-btn--cancel">✕</button>
      </div>
    </div>
  )
}
