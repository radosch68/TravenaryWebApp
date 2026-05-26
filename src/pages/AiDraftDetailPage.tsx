import { ArrowBigRight, CheckCircle2, FilePlus, Loader2, RefreshCw, SlidersHorizontal, Sparkles, XCircle } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import type {
  AiDraftItinerary,
  AiGenerationHistoryDetail,
  AiGenerationHistoryItem,
  DraftActivityObject,
  DraftBlockActivity,
} from '@/services/contracts'
import { getAiGenerationHistoryDetail, selectAiDraft } from '@/services/ai-generation-service'
import { unsplashUrl } from '@/utils/unsplash-url'

import styles from './AiDraftDetailPage.module.css'

function formatDateTime(iso: string | undefined, language: string): string {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDateRange(startDate: string, endDate: string, language: string): string {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`
  }

  const formatter = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${formatter.format(start)} - ${formatter.format(end)}`
}

function draftDayCount(draft: AiDraftItinerary): number {
  if (draft.days && draft.days.length > 0) {
    return draft.days.length
  }

  const start = new Date(`${draft.startDate}T00:00:00Z`)
  const end = new Date(`${draft.endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
}

function renderPresentValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatResponseSeconds(responseMs: number): string {
  return (responseMs / 1000).toFixed(1)
}

function getElapsedSeconds(startedAt: string | undefined, nowEpochMs: number): number | null {
  if (!startedAt) {
    return null
  }

  const startedAtMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedAtMs)) {
    return null
  }

  return Math.max(0, Math.floor((nowEpochMs - startedAtMs) / 1000))
}

function renderStatusIcon(status: AiGenerationHistoryDetail['status']): ReactElement {
  if (status === 'completed') {
    return <CheckCircle2 className={styles.statusIcon} aria-hidden="true" />
  }

  if (status === 'failed') {
    return <XCircle className={styles.statusIcon} aria-hidden="true" />
  }

  return <Loader2 className={`${styles.statusIcon} ${styles.statusIconSpinning}`} aria-hidden="true" />
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isActivityObject(activity: DraftBlockActivity): activity is DraftActivityObject {
  if (typeof activity !== 'object' || activity === null) {
    return false
  }

  const candidate = activity as Partial<DraftActivityObject> & { time?: unknown; timeEnd?: unknown }

  return (
    hasNonEmptyString(candidate.title)
    && hasNonEmptyString(candidate.type)
    && (candidate.time === undefined || candidate.time === null || typeof candidate.time === 'string')
    && (candidate.timeEnd === undefined || candidate.timeEnd === null || typeof candidate.timeEnd === 'string')
  )
}

function renderDraftActivity(activity: DraftBlockActivity): ReactElement {
  if (!isActivityObject(activity)) {
    return <>{activity}</>
  }

  const timeLabel = activity.time
    ? activity.timeEnd
      ? `${activity.time}-${activity.timeEnd}`
      : activity.time
    : null

  return (
    <span className={styles.activityItem}>
      <span className={styles.activityType}>{activity.type}</span>
      {timeLabel ? <span className={styles.activityTime}>{timeLabel}</span> : null}
      <span className={styles.activityTitle}>{activity.title}</span>
      {activity.description ? <span className={styles.activityDescription}>{activity.description}</span> : null}
    </span>
  )
}

export function AiDraftDetailPage(): ReactElement {
  const { requestId } = useParams<{ requestId: string }>()
  const { t, i18n } = useTranslation(['ai-generation', 'common'])
  const navigate = useNavigate()

  const [detail, setDetail] = useState<AiGenerationHistoryDetail | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingDraftId, setCreatingDraftId] = useState<string | null>(null)
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<Record<string, number>>({})
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now())
  const lineageListRef = useRef<HTMLOListElement | null>(null)

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!requestId) {
      return
    }

    if (loadState === 'idle') {
      setLoadState('loading')
    }

    try {
      const response = await getAiGenerationHistoryDetail(requestId)
      setDetail(response)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [loadState, requestId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDetail()
  }, [fetchDetail])

  useEffect(() => {
    if (!detail || detail.status !== 'pending') {
      return
    }

    const interval = window.setInterval(() => {
      void fetchDetail()
    }, 5000)

    return () => {
      window.clearInterval(interval)
    }
  }, [detail, fetchDetail])

  useEffect(() => {
    if (!detail || detail.status !== 'pending') {
      return
    }

    const interval = window.setInterval(() => {
      setNowEpochMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [detail])

  const lineageItems = useMemo<Array<AiGenerationHistoryItem | AiGenerationHistoryDetail>>(
    () => detail ? [...detail.lineage, detail] : [],
    [detail],
  )

  useEffect(() => {
    if (lineageItems.length <= 1) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const list = lineageListRef.current
      if (list) {
        list.scrollLeft = list.scrollWidth
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [lineageItems.length, detail?.id])

  const settingsRows = useMemo(() => {
    if (!detail) {
      return [] as Array<{ label: string; value: string }>
    }

    const languageRequested = (() => {
      if (detail.context.languageMode === 'curated') {
        const code = renderPresentValue(detail.context.languageCode)
        if (!code) {
          return null
        }

        return t(`ai-generation:start.languageCodes.${code}`, { defaultValue: code })
      }

      if (detail.context.languageMode === 'other') {
        return renderPresentValue(detail.context.languageOther)
      }

      if (detail.context.languageMode === 'auto') {
        return t('ai-generation:start.languageAuto')
      }

      return renderPresentValue(detail.context.languageOther) ?? renderPresentValue(detail.context.languageCode)
    })()

    const timingLabel = detail.context.timing
      ? t(`ai-generation:start.timingValues.${detail.context.timing}`, {
          defaultValue: detail.context.timing,
        })
      : null
    const timingDetails = renderPresentValue(detail.context.timingOther)
    const timingValue =
      detail.context.timing === 'other' || detail.context.timing === 'customDates'
        ? timingDetails
        : timingLabel ?? timingDetails

    const travelerLabel = detail.context.travelerProfile
      ? t(`ai-generation:start.travelerProfileValues.${detail.context.travelerProfile}`, {
          defaultValue: detail.context.travelerProfile,
        })
      : null
    const travelerDetails = renderPresentValue(detail.context.travelerProfileOther)
    const travelerValue =
      travelerLabel && travelerDetails ? `${travelerLabel}: ${travelerDetails}` : travelerLabel ?? travelerDetails

    const budgetLabel = detail.context.budgetProfile
      ? t(`ai-generation:start.budgetProfileValues.${detail.context.budgetProfile}`, {
          defaultValue: detail.context.budgetProfile,
        })
      : null
    const budgetDetails = renderPresentValue(detail.context.budgetProfileOther)
    const budgetValue =
      detail.context.budgetProfile === 'other' ? budgetDetails : budgetLabel ?? budgetDetails

    const rows: Array<{ label: string; value: string }> = []
    const addRow = (label: string, value: string | null): void => {
      const present = renderPresentValue(value)
      if (!present) {
        return
      }

      rows.push({ label, value: present })
    }

    addRow(t('ai-generation:detail.settings.model'), detail.selectedModel)
    addRow(t('ai-generation:detail.settings.requestedDraftCount'), String(detail.requestedDraftCount))
    addRow(t('ai-generation:detail.language'), languageRequested)
    addRow(t('ai-generation:detail.settings.departureFrom'), detail.context.departureFrom)
    addRow(t('ai-generation:detail.settings.timing'), timingValue)
    addRow(t('ai-generation:detail.settings.travelerProfile'), travelerValue)
    addRow(t('ai-generation:detail.settings.budgetProfile'), budgetValue)
    addRow(
      t('ai-generation:detail.settings.refinementMode'),
      detail.refinementMode
        ? t(`ai-generation:start.refinementModeValues.${detail.refinementMode}`)
        : null,
    )
    addRow(t('ai-generation:detail.settings.createdAt'), formatDateTime(detail.createdAt, i18n.language))

    return rows
  }, [detail, i18n.language, t])

  const handleCreateItinerary = useCallback(
    async (draft: AiDraftItinerary): Promise<void> => {
      if (!detail) {
        return
      }

      setActionError(null)
      setCreatingDraftId(draft._id)

      const selectedPhotoIndex = selectedPhotoIndexes[draft._id] ?? 0
      const selectedPhotoUrl = draft.coverPhotoOptions?.[selectedPhotoIndex]?.url ?? draft.coverPhotoOptions?.[0]?.url

      try {
        const created = await selectAiDraft(draft._id, detail.id, selectedPhotoUrl)
        navigate(`/itineraries/${created.itineraryId}`)
      } catch {
        setActionError(t('ai-generation:detail.createError'))
      } finally {
        setCreatingDraftId(null)
      }
    },
    [detail, navigate, selectedPhotoIndexes, t],
  )

  if (!requestId) {
    return (
      <AppShell>
        <section className={styles.stateCard}>{t('ai-generation:detail.invalidRequest')}</section>
      </AppShell>
    )
  }

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <AppShell>
        <section className={styles.stateCard}>{t('common:loading')}</section>
      </AppShell>
    )
  }

  if (loadState === 'error' || !detail) {
    return (
      <AppShell>
        <section className={styles.stateCard}>{t('ai-generation:detail.loadError')}</section>
      </AppShell>
    )
  }

  const runningSeconds =
    detail.status === 'pending' ? getElapsedSeconds(detail.generationStartedAt, nowEpochMs) : null

  return (
    <AppShell>
      <div className={styles.page}>
        {lineageItems.length > 1 ? (
          <nav className={styles.lineageCard} aria-label={t('ai-generation:detail.lineageAriaLabel')}>
            <p className={styles.sectionLabel}>{t('ai-generation:detail.lineageTitle')}</p>
            <ol ref={lineageListRef} className={styles.lineageList}>
              {lineageItems.map((item, index) => {
                const isCurrent = item.id === detail.id
                const label = index === 0
                  ? t('ai-generation:detail.lineageOriginal')
                  : t('ai-generation:detail.lineageRevision', { n: index })

                return (
                  <li key={item.id} className={styles.lineageItem}>
                    {index > 0 ? (
                      <ArrowBigRight className={styles.lineageSeparatorIcon} aria-hidden="true" />
                    ) : null}
                    {isCurrent ? (
                      <span
                        className={`${styles.lineageLink} ${styles.lineageCurrent}`}
                        aria-current="page"
                        title={item.prompt}
                      >
                        <span>{label}</span>
                        <span className={styles.lineagePrompt}>{item.prompt}</span>
                      </span>
                    ) : (
                      <Link className={styles.lineageLink} to={`/ai-drafts/${item.id}`} title={item.prompt}>
                        <span>{label}</span>
                        <span className={styles.lineagePrompt}>{item.prompt}</span>
                      </Link>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null}

        <section className={styles.bodyCard}>
          <div className={styles.bodyHeader}>
            <div className={styles.responseSummary}>
              {renderStatusIcon(detail.status)}

              <h2>{t('ai-generation:detail.draftsTitle', { count: detail.drafts.length })}</h2>
              <div className={styles.statusRow}>
                <span className={`${styles.statusBadge} ${styles[`status_${detail.status}`]}`}>
                  {t(`ai-generation:status.${detail.status}`)}
                </span>
                {runningSeconds != null ? (
                  <span className={styles.runningSecondsValue}>
                    {t('ai-generation:detail.runningSeconds', { seconds: runningSeconds })}
                  </span>
                ) : null}
                {detail.status === 'completed' ? (
                  <span className={styles.metaItem}>{t('ai-generation:detail.days', { count: detail.dayCount })}</span>
                ) : null}
                {detail.status === 'completed' && detail.aiModel ? <span className={styles.metaItem}>{detail.aiModel}</span> : null}
                {detail.status !== 'pending' && detail.aiResponseTimeMs != null ? (
                  <span className={styles.metaItem}>
                    {t('ai-generation:detail.responseSeconds', {
                      value: formatResponseSeconds(detail.aiResponseTimeMs),
                    })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={styles.bodyActions}>
              {detail.drafts.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.refreshIconButton}
                  onClick={() => {
                    void fetchDetail()
                  }}
                  disabled={creatingDraftId != null}
                  aria-label={t('common:dashboard.refresh')}
                  title={t('common:dashboard.refresh')}
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>

          {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

          {detail.drafts.length === 0 ? (
            <p className={styles.emptyText}>{t('ai-generation:detail.noDrafts')}</p>
          ) : (
            <div className={styles.draftsList}>
              {detail.drafts.map((draft) => (
                <article key={draft._id} className={styles.draftCard}>
                  {(() => {
                    const preview = draft.activities.slice(0, 4)
                    const remainingHighlights = Math.max(0, draft.activities.length - preview.length)
                    const benchActivities = draft.activityBench ?? []
                    const photoOptions = draft.coverPhotoOptions ?? []
                    const legacyCoverPhoto = (draft as AiDraftItinerary & { coverPhoto?: { url: string; caption?: string | null } | null }).coverPhoto
                    const selectedPhotoIndex = selectedPhotoIndexes[draft._id] ?? 0
                    const selectedPhoto = photoOptions[selectedPhotoIndex] ?? photoOptions[0] ?? legacyCoverPhoto ?? null

                    return (
                      <>
                        <header className={styles.draftHeader}>
                          <div>
                            <h3>{draft.title}</h3>
                            <p>{formatDateRange(draft.startDate, draft.endDate, i18n.language)}</p>
                          </div>
                          <div className={styles.draftActions}>
                            <Button asChild variant="secondary" size="sm" className={styles.draftActionButton}>
                              <Link to={`/ai-drafts/new?from=${detail.id}&sourceDraftId=${encodeURIComponent(draft._id)}`}>
                                <span className={styles.createButtonInner}>
                                  <SlidersHorizontal className={styles.createButtonIcon} aria-hidden="true" />
                                  <span className={styles.createButtonLabel}>
                                    <span className={styles.aiLabelIconWrap} aria-hidden="true">
                                      <Sparkles className={styles.inlineAiIcon} />
                                    </span>
                                    <span>{t('ai-generation:detail.refineWithAi')}</span>
                                  </span>
                                </span>
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.draftActionButton}
                              onClick={() => {
                                void handleCreateItinerary(draft)
                              }}
                              disabled={creatingDraftId === draft._id}
                            >
                              <span className={styles.createButtonInner}>
                                <FilePlus className={styles.createButtonIcon} aria-hidden="true" />
                                <span className={styles.createButtonLabel}>
                                  {creatingDraftId === draft._id
                                    ? t('ai-generation:detail.creatingOne')
                                    : t('ai-generation:detail.createItinerary')}
                                </span>
                              </span>
                            </Button>
                          </div>
                        </header>

                        {selectedPhoto?.url ? (
                          <figure className={styles.coverFigure}>
                            <div className={styles.coverLayout}>
                              {photoOptions.length > 0 ? (
                                <div className={styles.photoStrip} role="group" aria-label={t('ai-generation:detail.photoOptionsAriaLabel')}>
                                  {photoOptions.map((photo, index) => (
                                    <button
                                      key={`${photo.url}-${index}`}
                                      type="button"
                                      className={`${styles.photoThumb} ${selectedPhotoIndex === index ? styles.photoThumbSelected : ''}`}
                                      onClick={() => {
                                        setSelectedPhotoIndexes((previous) => ({ ...previous, [draft._id]: index }))
                                      }}
                                      disabled={creatingDraftId === draft._id}
                                      aria-label={photo.caption ?? draft.title}
                                    >
                                      <img src={unsplashUrl(photo.url, 120)} alt="" aria-hidden="true" loading="lazy" />
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              <img
                                className={styles.coverImage}
                                src={unsplashUrl(selectedPhoto.url, 600)}
                                alt={selectedPhoto.caption ?? draft.title}
                                title={selectedPhoto.caption ?? draft.title}
                                loading="lazy"
                              />
                            </div>
                            {selectedPhoto.caption ? <figcaption className={styles.coverCaption}>{selectedPhoto.caption}</figcaption> : null}
                          </figure>
                        ) : null}

                        {draft.description ? <p className={styles.description}>{draft.description}</p> : null}

                        <dl className={styles.draftMeta}>
                          <div>
                            <dt>{t('ai-generation:detail.draftDays')}</dt>
                            <dd>{draftDayCount(draft)}</dd>
                          </div>
                          <div>
                            <dt>{t('ai-generation:detail.highlights')}</dt>
                            <dd>{draft.activities.length}</dd>
                          </div>
                          <div>
                            <dt>{t('ai-generation:detail.language')}</dt>
                            <dd>{draft.language}</dd>
                          </div>
                        </dl>

                        {preview.length > 0 ? (
                          <div>
                            <p className={styles.sectionLabel}>{t('ai-generation:detail.highlights')}</p>
                            <ul className={styles.highlights}>
                              {preview.map((activity, index) => (
                                <li key={`${draft._id}-preview-${index}`}>{activity}</li>
                              ))}
                            </ul>
                            {remainingHighlights > 0 ? (
                              <details className={styles.moreActivities}>
                                <summary>
                                  +{remainingHighlights}{' '}
                                  {t('ai-generation:detail.moreActivities', { count: remainingHighlights })}
                                </summary>
                                <ul className={styles.highlights}>
                                  {draft.activities.slice(4).map((activity, index) => (
                                    <li key={`${draft._id}-rest-${index}`}>{activity}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        ) : null}

                        {draft.days && draft.days.length > 0 ? (
                          <div className={styles.dayPlan}>
                            <p className={styles.sectionLabel}>{t('ai-generation:detail.dayPlan')}</p>
                            {draft.days.map((day, dayIndex) => {
                              const dayDate = new Date(`${day.date}T00:00:00Z`)
                              const dayDateLabel = Number.isNaN(dayDate.getTime())
                                ? day.date
                                : dayDate.toLocaleDateString(i18n.language, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })

                              return (
                                <details key={`${draft._id}-${day.date}-${dayIndex}`} className={styles.dayEntry}>
                                  <summary className={styles.daySummary}>
                                    {t('ai-generation:detail.dayLabel', { n: dayIndex + 1 })} - {dayDateLabel}
                                  </summary>
                                  {day.blocks && day.blocks.length > 0 ? (
                                    <div className={styles.blockList}>
                                      {day.blocks.map((block, blockIndex) => (
                                        <div key={`${draft._id}-${dayIndex}-block-${blockIndex}`} className={styles.blockCard}>
                                          {block.label ? <span className={styles.blockLabel}>{block.label}</span> : null}
                                          <ul className={styles.highlights}>
                                            {block.activities.map((activity, activityIndex) => (
                                              <li key={`${draft._id}-${dayIndex}-${blockIndex}-${activityIndex}`}>
                                                {renderDraftActivity(activity)}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {day.notesForDay ? <p className={styles.description}>{day.notesForDay}</p> : null}
                                </details>
                              )
                            })}
                          </div>
                        ) : null}

                        {benchActivities.length > 0 ? (
                          <div className={styles.benchSection}>
                            <p className={styles.sectionLabel}>{t('ai-generation:detail.activityBench')}</p>
                            <details className={styles.benchDetails}>
                              <summary>
                                {t('ai-generation:detail.activityBenchToggle', {
                                  count: benchActivities.length,
                                })}
                              </summary>
                              <ul className={styles.highlights}>
                                {benchActivities.map((activity, index) => (
                                  <li key={`${draft._id}-bench-${index}`}>{renderDraftActivity(activity)}</li>
                                ))}
                              </ul>
                            </details>
                          </div>
                        ) : null}

                        {draft.tags.length > 0 ? (
                          <div className={styles.tags} aria-label={t('ai-generation:detail.tags')}>
                            {draft.tags.map((tag) => (
                              <span key={`${draft._id}-tag-${tag}`} className={styles.tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.headerCard}>
          <div className={styles.headerTopRow}>
            <div>
              <p className={styles.kicker}>{t('ai-generation:detail.kicker')}</p>
              <h1 className={styles.title}>{t('ai-generation:detail.title')}</h1>
            </div>
          </div>

          <p className={styles.prompt}>{detail.prompt}</p>

          <dl className={styles.settingsGrid}>
            {settingsRows.map((row) => (
              <div key={row.label} className={styles.settingsItem}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          {detail.errorMessage ? <p className={styles.errorText}>{detail.errorMessage}</p> : null}
        </section>
      </div>
    </AppShell>
  )
}
