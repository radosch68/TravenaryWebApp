import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import {
  CommonListingHeader,
  CommonListingPagination,
  CommonListingStateCard,
} from '@/components/common/CommonListing'
import { NewItineraryTile } from '@/components/common/NewItineraryTile'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import type { AiGenerationHistoryItem } from '@/services/contracts'
import { listAiGenerationHistory } from '@/services/ai-generation-service'

import styles from './AiDraftsListPage.module.css'

type SortBy = 'createdAt' | 'updatedAt' | 'generationCompletedAt' | 'draftCount'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'pending' | 'completed' | 'failed'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

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

function parsePageSize(value: string | null): PageSize {
  const parsed = Number.parseInt(value ?? '20', 10)
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSize) ? (parsed as PageSize) : 20
}

function parseSortBy(value: string | null): SortBy {
  if (value === 'createdAt' || value === 'updatedAt' || value === 'generationCompletedAt' || value === 'draftCount') {
    return value
  }
  return 'createdAt'
}

function parseSortOrder(value: string | null): SortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}

function parseStatus(value: string | null): StatusFilter {
  if (value === 'pending' || value === 'completed' || value === 'failed') {
    return value
  }
  return 'all'
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

function renderStatusIcon(status: AiGenerationHistoryItem['status']): ReactElement {
  if (status === 'completed') {
    return <CheckCircle2 className={styles.statusIcon} aria-hidden="true" />
  }

  if (status === 'failed') {
    return <XCircle className={styles.statusIcon} aria-hidden="true" />
  }

  return <Loader2 className={`${styles.statusIcon} ${styles.statusIconSpinning}`} aria-hidden="true" />
}

export function AiDraftsListPage(): ReactElement {
  const { t, i18n } = useTranslation(['ai-generation', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AiGenerationHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [retentionDays, setRetentionDays] = useState<number | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSingleColumnList, setIsSingleColumnList] = useState(true)
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now())
  const listRef = useRef<HTMLElement | null>(null)

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = parsePageSize(searchParams.get('limit'))
  const sortBy = parseSortBy(searchParams.get('sortBy'))
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'))
  const status = parseStatus(searchParams.get('status'))

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const fetchItems = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial'): Promise<void> => {
      if (mode === 'refresh') {
        setIsRefreshing(true)
      } else {
        setLoadState('loading')
      }

      try {
        const response = await listAiGenerationHistory({
          page,
          limit,
          sortBy,
          sortOrder,
          ...(status !== 'all' ? { status } : {}),
        })

        setItems(response.items)
        setTotal(response.total)
        setRetentionDays(response.retentionDays)
        setLoadState('ready')
      } catch {
        setLoadState('error')
      } finally {
        setIsRefreshing(false)
      }
    },
    [limit, page, sortBy, sortOrder, status],
  )

  useEffect(() => {
    const current = new URLSearchParams(searchParams)
    current.set('page', String(page))
    current.set('limit', String(limit))
    current.set('sortBy', sortBy)
    current.set('sortOrder', sortOrder)
    current.set('status', status)

    const currentEncoded = searchParams.toString()
    const normalizedEncoded = current.toString()
    if (currentEncoded !== normalizedEncoded) {
      setSearchParams(current, { replace: true })
      return
    }

    const timer = window.setTimeout(() => {
      void fetchItems('initial')
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchItems, limit, page, searchParams, setSearchParams, sortBy, sortOrder, status])

  useEffect(() => {
    if (loadState !== 'ready') {
      return
    }

    const listElement = listRef.current
    if (!listElement) {
      return
    }

    const updateColumnMode = (): void => {
      const cards = Array.from(listElement.querySelectorAll<HTMLElement>('[data-ai-draft-card="true"]'))

      if (cards.length < 2) {
        setIsSingleColumnList(true)
        return
      }

      const firstTop = cards[0].offsetTop
      const hasAnotherCardOnFirstRow = cards.slice(1).some((card) => card.offsetTop === firstTop)
      setIsSingleColumnList(!hasAnotherCardOnFirstRow)
    }

    updateColumnMode()
    const resizeObserver = new ResizeObserver(() => {
      updateColumnMode()
    })
    resizeObserver.observe(listElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [items.length, loadState])

  useEffect(() => {
    if (!items.some((item) => item.status === 'pending')) {
      return
    }

    const interval = window.setInterval(() => {
      setNowEpochMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [items])

  const title = useMemo(() => t('ai-generation:list.title'), [t])
  const canGoPrev = page > 1 && !isRefreshing
  const canGoNext = page < totalPages && !isRefreshing

  return (
    <AppShell>
      <div className={styles.page}>
        <CommonListingHeader
          kicker={t('ai-generation:list.kicker')}
          title={title}
          subtitle={t('ai-generation:list.totalCount', { count: total })}
          controlsAlign="end"
          actions={(
            <div className={styles.headerActions}>
              <NewItineraryTile
                newItineraryLabel={t('common:dashboardHome.newItineraryTile.newItinerary')}
                aiHref="/ai-drafts/new"
                aiLabel={t('common:dashboardHome.newItineraryTile.ai')}
                manualHref="/itineraries/new/manual"
                manualLabel={t('common:dashboardHome.newItineraryTile.manual')}
              />
            </div>
          )}
          controls={(
            <div className={styles.controlsRowContent}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.headerIconButton}
                onClick={() => {
                  void fetchItems('refresh')
                }}
                disabled={isRefreshing || loadState === 'loading'}
                aria-label={t('common:dashboard.refresh')}
                title={t('common:dashboard.refresh')}
              >
                <RefreshCw aria-hidden="true" />
              </Button>

              <div className={styles.controlsCompact}>
                <label className={styles.controlGroup}>
                  <span className={styles.controlLabel}>{t('ai-generation:list.statusFilter')}</span>
                  <select
                    className={`${styles.controlSelect} ${styles.statusSelect}`}
                    value={status}
                    onChange={(event) => {
                      const next = new URLSearchParams(searchParams)
                      next.set('status', event.target.value)
                      next.set('page', '1')
                      setSearchParams(next)
                    }}
                    disabled={isRefreshing || loadState === 'loading'}
                  >
                    <option value="all">{t('ai-generation:list.statusAll')}</option>
                    <option value="pending">{t('ai-generation:status.pending')}</option>
                    <option value="completed">{t('ai-generation:status.completed')}</option>
                    <option value="failed">{t('ai-generation:status.failed')}</option>
                  </select>
                </label>

                <label className={styles.controlGroup}>
                  <span className={styles.controlLabel}>{t('common:dashboard.pageSizeLabel')}</span>
                  <select
                    className={`${styles.controlSelect} ${styles.pageSizeSelect}`}
                    value={String(limit)}
                    onChange={(event) => {
                      const next = new URLSearchParams(searchParams)
                      next.set('limit', event.target.value)
                      next.set('page', '1')
                      setSearchParams(next)
                    }}
                    disabled={isRefreshing || loadState === 'loading'}
                  >
                    {PAGE_SIZE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.controlGroup}>
                  <span className={styles.controlLabel}>{t('common:dashboard.sortByLabel')}</span>
                  <select
                    className={`${styles.controlSelect} ${styles.sortBySelect}`}
                    value={sortBy}
                    onChange={(event) => {
                      const next = new URLSearchParams(searchParams)
                      next.set('sortBy', event.target.value)
                      next.set('page', '1')
                      setSearchParams(next)
                    }}
                    disabled={isRefreshing || loadState === 'loading'}
                  >
                    <option value="createdAt">{t('ai-generation:list.sortByCreatedAt')}</option>
                    <option value="updatedAt">{t('ai-generation:list.sortByUpdatedAt')}</option>
                    <option value="generationCompletedAt">{t('ai-generation:list.sortByCompletedAt')}</option>
                    <option value="draftCount">{t('ai-generation:list.sortByDraftCount')}</option>
                  </select>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.sortOrderButton}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
                    next.set('page', '1')
                    setSearchParams(next)
                  }}
                  disabled={isRefreshing || loadState === 'loading'}
                  aria-label={sortOrder === 'asc' ? t('common:dashboard.sortAsc') : t('common:dashboard.sortDesc')}
                  title={sortOrder === 'asc' ? t('common:dashboard.sortAsc') : t('common:dashboard.sortDesc')}
                >
                  <svg className={styles.sortGlyph} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M10 5H22M10 10H19M10 15H16M10 20H13"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {sortOrder === 'asc' ? (
                      <path
                        d="M4 20V7M4 7L1.5 9.5M4 7L6.5 9.5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : (
                      <path
                        d="M4 4V17M4 17L1.5 14.5M4 17L6.5 14.5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </Button>
              </div>
            </div>
          )}
        />

        <p className={styles.ttlNotice}>
          {retentionDays && retentionDays > 0
            ? t('ai-generation:list.ttlNoticeWithDays', { days: retentionDays })
            : t('ai-generation:list.ttlNoticeGeneric')}
        </p>

        {loadState === 'loading' || loadState === 'idle' ? (
          <CommonListingStateCard>
            <p>{t('common:loading')}</p>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'error' ? (
          <CommonListingStateCard>
            <p>{t('ai-generation:list.loadError')}</p>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'ready' && items.length === 0 ? (
          <CommonListingStateCard>
            <p>{t('ai-generation:list.empty')}</p>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'ready' && items.length > 0 ? (
          <>
            <section
              ref={listRef}
              className={`${styles.list} ${isSingleColumnList ? styles.listSingleColumn : styles.listMultiColumn}`}
            >
              {items.map((item) => (
                <article
                  key={item.id}
                  data-ai-draft-card="true"
                  className={`${styles.card} ${isSingleColumnList ? styles.cardSingleColumn : styles.cardMultiColumn}`}
                >
                  {/** Pending rows surface live elapsed seconds prominently while generation runs. */}
                  {(() => {
                    const runningSeconds =
                      item.status === 'pending'
                        ? getElapsedSeconds(item.generationStartedAt, nowEpochMs)
                        : null

                    return (
                  <Link to={`/ai-drafts/${item.id}`} className={styles.cardLink}>
                    <div className={`${styles.statusRail} ${styles[`statusRail_${item.status}`]}`}>
                      <span className={styles.statusText}>{t(`ai-generation:status.${item.status}`)}</span>
                      {renderStatusIcon(item.status)}
                      {runningSeconds != null ? (
                        <span className={styles.runningSecondsValue}>
                          {t('ai-generation:list.runningSeconds', { seconds: runningSeconds })}
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.cardBody}>
                      <p className={styles.prompt}>{item.prompt}</p>

                      <dl className={styles.metrics}>
                        {item.status !== 'pending' ? (
                          <div>
                            <dt>{t('ai-generation:list.generatedDrafts')}</dt>
                            <dd>{item.generatedDraftCount}</dd>
                          </div>
                        ) : null}
                        {item.status === 'completed' ? (
                          <>
                            <div>
                              <dt>{t('ai-generation:list.days')}</dt>
                              <dd>{item.dayCount}</dd>
                            </div>
                            <div>
                              <dt>{t('ai-generation:list.model')}</dt>
                              <dd>{item.selectedModel}</dd>
                            </div>
                          </>
                        ) : null}
                        <div>
                          <dt>{t('ai-generation:list.createdAt')}</dt>
                          <dd>{formatDateTime(item.createdAt, i18n.language)}</dd>
                        </div>
                      </dl>
                    </div>
                  </Link>
                    )
                  })()}
                </article>
              ))}
            </section>

            <CommonListingPagination
              totalPages={totalPages}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={() => {
                const next = new URLSearchParams(searchParams)
                next.set('page', String(Math.max(1, page - 1)))
                setSearchParams(next)
              }}
              onNext={() => {
                const next = new URLSearchParams(searchParams)
                next.set('page', String(Math.min(totalPages, page + 1)))
                setSearchParams(next)
              }}
              previousLabel={t('common:dashboard.previousPage')}
              nextLabel={t('common:dashboard.nextPage')}
              pageLabel={t('common:dashboard.pageXofY', { page, totalPages })}
              ariaLabel={t('common:dashboard.paginationAria')}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
