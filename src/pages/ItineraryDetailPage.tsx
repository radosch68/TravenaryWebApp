import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EditableField } from '@/components/EditableField'
import { ShareButton } from '@/components/ShareButton'
import { ItineraryPlanningView } from '@/components/itinerary/ItineraryPlanningView'
import { ItineraryTimelineView } from '@/components/itinerary/ItineraryTimelineView'
import { ApiError } from '@/services/contracts'
import { deleteItinerary, getItinerary, updateItinerary } from '@/services/itinerary-service'
import type { ItineraryActivity, ItineraryActivityInput, ItineraryDay, UpdateItineraryRequest, ItineraryDetail } from '@/services/contracts'
import { formatLocalDate } from '@/utils/date-format'
import { isAnchoredByDefault } from '@/utils/activity-classification'
import { unsplashUrl } from '@/utils/unsplash-url'

type PresentationMode = 'planning' | 'timeline'

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
  const [presentationMode, setPresentationMode] = useState<PresentationMode>('planning')

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

  const handleToggleAnchored = useCallback(
    (dayNumber: number, activityId: string, newValue: boolean) => {
      if (!itinerary) return
      const updatedDays = itinerary.days.map((day) => {
        if (day.dayNumber !== dayNumber) return day
        return {
          ...day,
          activities: day.activities.map((a) =>
            a.id === activityId ? { ...a, isAnchored: newValue } : a,
          ),
        }
      })
      const previousDays = itinerary.days
      setItinerary((prev) => prev ? { ...prev, days: updatedDays } : prev)
      const daysPayload = buildDayPayload(updatedDays)
      void patchItinerary({ days: daysPayload }).catch(() => {
        setItinerary((prev) => prev ? { ...prev, days: previousDays } : prev)
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
            <div className="editable-display itinerary-detail-tags-block">
              <div className="itinerary-detail-panel__top-actions">
                <ShareButton
                  itineraryId={itinerary.id}
                  hasShareLink={itinerary.hasShareLink}
                  onShareChange={(has) => setItinerary((prev) => prev ? { ...prev, hasShareLink: has } : prev)}
                />
                <PanelCloseButton ariaLabel={t('common:itinerary.backToDashboard')} />
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

        {/* Dates + day count + presentation toggle — 2-row grid */}
        <div className="itinerary-detail-meta-grid">
          <div className="itinerary-detail-meta-grid__left">
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
          </div>
          <span className="itinerary-detail-meta-grid__right itinerary-detail-day-count">
            {t('common:itinerary.dayCount', { count: itinerary.days.length })}
          </span>

          <div className="itinerary-detail-meta-grid__left">
            <EditableField
              value={itinerary.endDate ?? ''}
              onSave={async (v) => {
                if (!v) {
                  await patchItinerary({ startDate: null })
                  return
                }
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
          </div>
          <div className="itinerary-detail-meta-grid__right">
            <div className="presentation-toggle" role="group" aria-label={t('common:itinerary.presentation.toggleLabel')}>
              <button
                type="button"
                className={`presentation-toggle__btn${presentationMode === 'planning' ? ' presentation-toggle__btn--active' : ''}`}
                onClick={() => setPresentationMode('planning')}
              >
                {t('common:itinerary.presentation.planning')}
              </button>
              <button
                type="button"
                className={`presentation-toggle__btn${presentationMode === 'timeline' ? ' presentation-toggle__btn--active' : ''}`}
                onClick={() => setPresentationMode('timeline')}
              >
                {t('common:itinerary.presentation.timeline')}
              </button>
            </div>
          </div>
        </div>

        {/* Day list — presentation-dependent rendering */}
        {presentationMode === 'planning' ? (
          <ItineraryPlanningView
            itinerary={itinerary}
            onReorder={handlePlanningReorder}
            onToggleAnchored={handleToggleAnchored}
            reorderError={reorderError}
          />
        ) : (
          <ItineraryTimelineView itinerary={itinerary} />
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
          <PanelCloseButton ariaLabel={t('common:itinerary.backToDashboard')} />
        </div>
      </section>
    </main>
  )
}

function PanelCloseButton({ ariaLabel }: { ariaLabel: string }): ReactElement {
  return (
    <Link
      to="/"
      className="panel-close-button"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <CloseIcon />
    </Link>
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

function buildDayPayload(days: ItineraryDay[]): UpdateItineraryRequest['days'] {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    summary: day.summary,
    activities: day.activities.map(toActivityInput),
  }))
}

function toActivityInput(activity: ItineraryActivity): ItineraryActivityInput {
  const { isAnchored, ...rest } = activity as ItineraryActivity & Record<string, unknown>

  if (isAnchored === isAnchoredByDefault(activity.type)) {
    return rest as ItineraryActivityInput
  }

  return {
    ...(rest as ItineraryActivityInput),
    isAnchored,
  }
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
