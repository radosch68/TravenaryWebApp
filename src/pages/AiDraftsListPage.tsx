import { Layers, RefreshCw, X } from 'lucide-react'
import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { AiStatusIcon } from '@/components/common/AiStatusIcon'
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

import { formatDateTime } from '@/utils/date-format'
import type { LoadState } from '@/utils/load-state'

import styles from './AiDraftsListPage.module.css'

type SortBy = 'createdAt' | 'updatedAt' | 'generationCompletedAt' | 'draftCount'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'pending' | 'completed' | 'failed'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

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

// A spread of visually distinct, non-reddish hues (green, blue, brown, violet,
// teal, amber, slate, indigo, deep cyan, olive, magenta, navy) so sibling groups
// read as clearly different colors. Reds are deliberately excluded — they read
// as an error/destructive state.
const ROOT_ACCENT_PALETTE = [
  '#2f9e44',
  '#1c7ed6',
  '#9c6b3f',
  '#7048e8',
  '#0ca678',
  '#f59f00',
  '#495d6e',
  '#5f3dc4',
  '#0b7285',
  '#5c940d',
  '#9c36b5',
  '#1864ab',
] as const

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

export function AiDraftsListPage(): ReactElement {
  const { t, i18n } = useTranslation(['ai-generation', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AiGenerationHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [retentionDays, setRetentionDays] = useState<number | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSingleColumnList, setIsSingleColumnList] = useState(true)
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now())
  const listRef = useRef<HTMLElement | null>(null)

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = parsePageSize(searchParams.get('limit'))
  const sortBy = parseSortBy(searchParams.get('sortBy'))
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'))
  const status = parseStatus(searchParams.get('status'))
  const rootRequestId = searchParams.get('rootRequestId') ?? undefined

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
          ...(rootRequestId ? { rootRequestId } : {}),
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
    [limit, page, sortBy, sortOrder, status, rootRequestId],
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

  const filterByRoot = useCallback(
    (rootId: string): void => {
      const next = new URLSearchParams(searchParams)
      next.set('rootRequestId', rootId)
      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const clearRootFilter = useCallback((): void => {
    const next = new URLSearchParams(searchParams)
    next.delete('rootRequestId')
    next.set('page', '1')
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  // Assign a distinct palette color per root by order of appearance, so different
  // roots visible on the page never share a color (hashing collided too easily).
  const rootColorByRequestId = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      if (item.ancestorCount > 0 && item.rootRequestId && !map.has(item.rootRequestId)) {
        map.set(item.rootRequestId, ROOT_ACCENT_PALETTE[map.size % ROOT_ACCENT_PALETTE.length])
      }
    }
    return map
  }, [items])

  // All leaves in a filtered view share one root, so any item's rootPrompt names the group.
  const activeRootPrompt = rootRequestId ? (items.find((item) => item.rootPrompt)?.rootPrompt ?? null) : null

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

        {rootRequestId ? (
          <div className={styles.activeFilter}>
            <span>{t('ai-generation:list.activeFilterLabel')}</span>
            {activeRootPrompt ? (
              <span className={styles.activeFilterPrompt}>
                {activeRootPrompt.length > 150 ? `${activeRootPrompt.slice(0, 150)}…` : activeRootPrompt}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.activeFilterClear}
              onClick={clearRootFilter}
            >
              <X aria-hidden="true" />
              {t('ai-generation:list.clearRootFilter')}
            </Button>
          </div>
        ) : null}

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
              {items.map((item) => {
                const accentColor =
                  item.ancestorCount > 0 && item.rootRequestId
                    ? rootColorByRequestId.get(item.rootRequestId) ?? null
                    : null
                const isActiveRoot = accentColor != null && item.rootRequestId === rootRequestId

                return (
                <article
                  key={item.id}
                  data-ai-draft-card="true"
                  data-grouped={accentColor ? 'true' : undefined}
                  className={`${styles.card} ${isSingleColumnList ? styles.cardSingleColumn : styles.cardMultiColumn}`}
                  style={accentColor ? ({ '--root-accent': accentColor } as CSSProperties) : undefined}
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
                      <AiStatusIcon status={item.status} className={styles.statusIcon} />
                      {runningSeconds != null ? (
                        <span className={styles.runningSecondsValue}>
                          {t('ai-generation:list.runningSeconds', { seconds: runningSeconds })}
                        </span>
                      ) : item.ancestorCount > 0 && accentColor && item.rootRequestId ? (
                        <button
                          type="button"
                          className={styles.revisionFilterButton}
                          data-active={isActiveRoot ? 'true' : undefined}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            filterByRoot(item.rootRequestId as string)
                          }}
                          aria-label={t('ai-generation:list.filterByRootAria')}
                          title={item.rootPrompt ?? t('ai-generation:list.filterByRootAria')}
                        >
                          <Layers aria-hidden="true" />
                          {t('ai-generation:list.revisionCount', { count: item.ancestorCount })}
                        </button>
                      ) : item.ancestorCount > 0 ? (
                        <span className={styles.revisionRailText}>
                          <Layers aria-hidden="true" />
                          {t('ai-generation:list.revisionCount', { count: item.ancestorCount })}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>

                    <div className={styles.cardBody}>
                      {item.ancestorCount > 0 && item.rootPrompt ? (
                        <>
                          <p className={styles.prompt}>{item.rootPrompt}</p>
                          <p className={styles.latestPrompt}>
                            <span className={styles.latestPromptLabel}>
                              {t('ai-generation:list.latestRevisionLabel')}
                            </span>
                            {item.prompt}
                          </p>
                        </>
                      ) : (
                        <p className={styles.prompt}>{item.prompt}</p>
                      )}

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
                )
              })}
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
