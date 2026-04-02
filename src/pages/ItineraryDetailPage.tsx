import type { MutableRefObject, ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EditableField } from '@/components/EditableField'
import { ShareButton } from '@/components/ShareButton'
import { ApiError } from '@/services/contracts'
import { deleteItinerary, getItinerary, updateItinerary } from '@/services/itinerary-service'
import type { ItineraryDetail, ItineraryDay } from '@/services/contracts'
import { formatLocalDate, formatWeekday } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

export function ItineraryDetailPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common'])

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [reorderError, setReorderError] = useState(false)
  const [suppressRowNavigation, setSuppressRowNavigation] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const dragHappenedRef = useRef(false)
  const dragSuppressTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (dragSuppressTimeoutRef.current !== null) {
        window.clearTimeout(dragSuppressTimeoutRef.current)
      }
    }
  }, [])

  const handleDragEnd = (event: DragEndEvent): void => {
    if (!itinerary) return
    const { active, over } = event
    if (over && active.id !== over.id) {
      const days = itinerary.days
      const oldIndex = days.findIndex((d) => String(d.dayNumber) === String(active.id))
      const newIndex = days.findIndex((d) => String(d.dayNumber) === String(over.id))
      if (oldIndex < 0 || newIndex < 0) {
        return
      }
      const previousDays = days
      const reordered = arrayMove(days, oldIndex, newIndex).map((d, i) => ({ ...d, dayNumber: i + 1 }))
      const daysPayload = reordered.map((d) => ({
        dayNumber: d.dayNumber,
        summary: d.summary,
        activities: d.activities,
      }))
      setReorderError(false)
      setItinerary((prev) => prev ? { ...prev, days: reordered } : prev)
      void patchItinerary({ days: daysPayload }).catch(() => {
        setItinerary((prev) => prev ? { ...prev, days: previousDays } : prev)
        setReorderError(true)
      })
    }
  }

  const patchItinerary = useCallback(
    async (data: Record<string, unknown>): Promise<void> => {
      if (!itineraryId) return
      const updated = await updateItinerary(itineraryId, data)
      setItinerary(updated)
    },
    [itineraryId],
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

      setState('error')
    }
  }, [itineraryId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

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

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb items={[{ icon: 'home', to: '/', ariaLabel: t('common:itinerary.backToDashboard') }, { label: itinerary.title }]} />
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
            <div className="editable-display itinerary-detail-tags-row">
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
                      <span key={tag} className="itinerary-tag-chip">{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted">{t('common:itinerary.edit.tags')}</p>
              )}
              <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.tags')}>
                <PencilIcon />
              </button>
              <ShareButton
                itineraryId={itinerary.id}
                hasShareLink={itinerary.hasShareLink}
                onShareChange={(has) => setItinerary((prev) => prev ? { ...prev, hasShareLink: has } : prev)}
              />
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
                <PencilIcon />
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
                <PencilIcon />
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

        {/* Dates — start and end each with their own pencil, plus day count */}
        <div className="itinerary-detail-dates-row">
          <EditableField
            value={itinerary.startDate ?? ''}
            onSave={async (v) => patchItinerary({ startDate: v || null })}
            renderDisplay={(val, onEdit) => (
              <span className="editable-display editable-display--inline">
                <span>{val ? formatLocalDate(val, i18n.language) : t('common:itinerary.missingDate')}</span>
                <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.startDate')}>
                  <PencilIcon />
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
          <span className="itinerary-detail-dates-sep">–</span>
          <EditableField
            value={itinerary.endDate ?? ''}
            onSave={async (v) => {
              if (!v) {
                await patchItinerary({ startDate: null })
                return
              }
              // Derive new startDate = newEndDate - (dayCount - 1)
              const dayCount = itinerary.days.length
              if (dayCount <= 1) {
                await patchItinerary({ startDate: v })
                return
              }
              const endMs = new Date(v + 'T00:00:00Z').getTime()
              const newStartMs = endMs - (dayCount - 1) * 86_400_000
              const newStart = new Date(newStartMs).toISOString().slice(0, 10)
              await patchItinerary({ startDate: newStart })
            }}
            renderDisplay={(val, onEdit) => (
              <span className="editable-display editable-display--inline">
                <span>{val ? formatLocalDate(val, i18n.language) : t('common:itinerary.missingDate')}</span>
                <button type="button" className="edit-pencil" onClick={onEdit} aria-label={t('common:itinerary.edit.endDate')}>
                  <PencilIcon />
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
          <span className="itinerary-detail-day-count">{t('common:itinerary.dayCount', { count: itinerary.days.length })}</span>
        </div>

        {/* Day list — always DnD sortable; drag handle is the date span in the center */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => {
            dragHappenedRef.current = true
            if (dragSuppressTimeoutRef.current !== null) {
              window.clearTimeout(dragSuppressTimeoutRef.current)
              dragSuppressTimeoutRef.current = null
            }
            setSuppressRowNavigation(true)
          }}
          onDragEnd={(event) => {
            handleDragEnd(event)
            if (dragSuppressTimeoutRef.current !== null) {
              window.clearTimeout(dragSuppressTimeoutRef.current)
            }
            dragSuppressTimeoutRef.current = window.setTimeout(() => {
              setSuppressRowNavigation(false)
              dragHappenedRef.current = false
              dragSuppressTimeoutRef.current = null
            }, 450)
          }}
          onDragCancel={() => {
            dragHappenedRef.current = false
            if (dragSuppressTimeoutRef.current !== null) {
              window.clearTimeout(dragSuppressTimeoutRef.current)
              dragSuppressTimeoutRef.current = null
            }
            setSuppressRowNavigation(false)
          }}
        >
          <SortableContext items={itinerary.days.map((d) => String(d.dayNumber))} strategy={verticalListSortingStrategy}>
            <ul className="itinerary-day-list">
              {itinerary.days.map((day, index) => (
                <SortableDayRow
                  key={day.dayNumber}
                  day={day}
                  index={index}
                  itineraryId={itinerary.id}
                  dragHappenedRef={dragHappenedRef}
                  suppressRowNavigation={suppressRowNavigation}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {reorderError ? <p className="error">{t('common:itinerary.edit.saveFailed')}</p> : null}
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
          <Link to="/">{t('common:itinerary.backToDashboard')}</Link>
        </div>
      </section>
    </main>
  )
}

/* ---- Sortable day row (reorder mode) ---- */

interface SortableDayRowProps {
  day: ItineraryDay
  index: number
  itineraryId: string
  dragHappenedRef: MutableRefObject<boolean>
  suppressRowNavigation: boolean
}

function SortableDayRow({ day, index, itineraryId, dragHappenedRef, suppressRowNavigation }: SortableDayRowProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const { setNodeRef, transform, transition, isDragging, listeners, attributes } = useSortable({
    id: String(day.dayNumber),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`itinerary-day-list__item itinerary-day-list__item--${index % 2 === 0 ? 'odd' : 'even'}${isDragging ? ' itinerary-day-list__item--dragging' : ''}`}
    >
      <Link
        to={`/itineraries/${itineraryId}/days/${day.dayNumber}`}
        className="itinerary-day-link"
        style={{ display: 'block', color: 'inherit', cursor: 'pointer', pointerEvents: suppressRowNavigation ? 'none' : 'auto' }}
        onClick={(e) => {
          if (suppressRowNavigation || dragHappenedRef.current) {
            e.preventDefault()
            dragHappenedRef.current = false
            return
          }
        }}
      >
        <div className="itinerary-day-header">
          <span className="itinerary-day-header__weekday">
            <span
              className="itinerary-day-header__weekday--drag"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              {...listeners}
              {...attributes}
            >
              <GripIcon />
            </span>
            <span>{day.date ? formatWeekday(day.date, i18n.language) : '—'}</span>
          </span>
          <span
            className="itinerary-day-header__date"
            style={{ whiteSpace: 'nowrap' }}
          >
            {day.date ? formatLocalDate(day.date, i18n.language) : t('common:itinerary.missingDate')}
          </span>
          <span className="itinerary-day-header__index">
            {t('common:itinerary.dayNumber', { dayNumber: day.dayNumber })}
          </span>
        </div>
        {day.summary ? <p className="itinerary-day-summary">{day.summary}</p> : null}
      </Link>

      {day.activities.length > 0 ? (
        <details className="itinerary-day-activities">
          <summary>
            {t('common:itinerary.days.activityCount', { count: day.activities.length })}
          </summary>
          <ul className="itinerary-day-activities__list">
            {day.activities.map((activity) => (
              <li key={activity.id} className="itinerary-day-activity">
                <span className="itinerary-day-activity__type">{activity.type}</span>
                <span className="itinerary-day-activity__title">{activity.title}</span>
                {activity.time ? (
                  <span className="itinerary-day-activity__time">
                    {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="itinerary-day-activities__empty">{t('common:itinerary.days.noActivities')}</p>
      )}
    </li>
  )
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
        <PencilIcon />
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
      <button type="button" className="cover-add-placeholder" onClick={() => setEditing(true)}>
        <PencilIcon /> {t('common:itinerary.edit.coverPhoto')}
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

function PencilIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function GripIcon(): ReactElement {
  return (
    <svg
      width="24"
      height="18"
      viewBox="0 0 24 18"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M9 3L12 1l3 2" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="7" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="8" cy="7" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="12" cy="7" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="16" cy="7" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="20" cy="7" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="4" cy="11" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="8" cy="11" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="12" cy="11" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="16" cy="11" r="1" fill="currentColor" fillOpacity="0.55" />
      <circle cx="20" cy="11" r="1" fill="currentColor" fillOpacity="0.55" />
      <path d="M9 15l3 2 3-2" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
