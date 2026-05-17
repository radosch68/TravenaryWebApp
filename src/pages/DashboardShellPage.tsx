import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  CommonListingHeader,
  CommonListingPagination,
  CommonListingStateCard,
} from '@/components/common/CommonListing'
import { NewItineraryTile } from '@/components/common/NewItineraryTile'
import { AppShell } from '@/components/layout/AppShell'
import type { ItinerarySummary } from '@/services/contracts'
import { listItineraries } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { parseIsoDate } from '@/utils/date-format'

import styles from './DashboardShellPage.module.css'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
type SortBy = 'plannedStartDate' | 'createdAt' | 'dayCount' | 'updatedAt'
type SortOrder = 'asc' | 'desc'

const SORT_BY_OPTIONS: ReadonlyArray<SortBy> = [
  'plannedStartDate',
  'createdAt',
  'dayCount',
  'updatedAt',
]
const SORT_ORDER_OPTIONS: ReadonlyArray<SortOrder> = ['asc', 'desc']
const DEFAULT_PAGE_SIZE: PageSize = 20
const DEFAULT_SORT_BY: SortBy = 'plannedStartDate'
const DEFAULT_SORT_ORDER: SortOrder = 'asc'
const DEFAULT_INCLUDE_PAST = false
const LISTING_PREFS_STORAGE_KEY = 'travenary_itinerary_listing_prefs'

type ListingPrefs = {
  limit: PageSize
  sortBy: SortBy
  sortOrder: SortOrder
  includePast: boolean
}

function normalizeDisplayText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  language: string,
  fallbackLabel: string,
): string {
  if (!startDate && !endDate) {
    return fallbackLabel
  }

  const formatter = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  const isValidStart = Boolean(start && !Number.isNaN(start.getTime()))
  const isValidEnd = Boolean(end && !Number.isNaN(end.getTime()))

  if (isValidStart && isValidEnd && start && end) {
    return `${formatter.format(start)} - ${formatter.format(end)}`
  }

  if (isValidStart && start) {
    return formatter.format(start)
  }

  if (isValidEnd && end) {
    return formatter.format(end)
  }

  return fallbackLabel
}

function parseOptionalPageSize(raw: string | null): PageSize | null {
  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSize) ? (parsed as PageSize) : null
}

function parseOptionalSortBy(raw: string | null): SortBy | null {
  if (!raw) {
    return null
  }

  return SORT_BY_OPTIONS.includes(raw as SortBy) ? (raw as SortBy) : null
}

function parseOptionalSortOrder(raw: string | null): SortOrder | null {
  if (!raw) {
    return null
  }

  return SORT_ORDER_OPTIONS.includes(raw as SortOrder) ? (raw as SortOrder) : null
}

function parseOptionalIncludePast(raw: string | null): boolean | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }

  if (normalized === 'false') {
    return false
  }

  return null
}

function loadListingPrefs(): ListingPrefs {
  if (typeof window === 'undefined') {
    return {
      limit: DEFAULT_PAGE_SIZE,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
      includePast: DEFAULT_INCLUDE_PAST,
    }
  }

  try {
    const raw = window.localStorage.getItem(LISTING_PREFS_STORAGE_KEY)
    if (!raw) {
      return {
        limit: DEFAULT_PAGE_SIZE,
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        includePast: DEFAULT_INCLUDE_PAST,
      }
    }

    const parsed = JSON.parse(raw) as Partial<ListingPrefs>
    return {
      limit:
        typeof parsed.limit === 'number' && PAGE_SIZE_OPTIONS.includes(parsed.limit as PageSize)
          ? (parsed.limit as PageSize)
          : DEFAULT_PAGE_SIZE,
      sortBy: SORT_BY_OPTIONS.includes(parsed.sortBy as SortBy)
        ? (parsed.sortBy as SortBy)
        : DEFAULT_SORT_BY,
      sortOrder: SORT_ORDER_OPTIONS.includes(parsed.sortOrder as SortOrder)
        ? (parsed.sortOrder as SortOrder)
        : DEFAULT_SORT_ORDER,
      includePast: parsed.includePast === true,
    }
  } catch {
    return {
      limit: DEFAULT_PAGE_SIZE,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
      includePast: DEFAULT_INCLUDE_PAST,
    }
  }
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function isPastItinerary(item: ItinerarySummary, todayIsoDate: string): boolean {
  if (!item.endDate) {
    return false
  }

  return item.endDate < todayIsoDate
}

function isOngoingItinerary(item: ItinerarySummary, todayIsoDate: string): boolean {
  if (!item.startDate || !item.endDate) {
    return false
  }

  return item.startDate <= todayIsoDate && item.endDate >= todayIsoDate
}

function getUpcomingDaysLeft(startDate: string | undefined, todayIsoDate: string): number | null {
  if (!startDate || startDate <= todayIsoDate) {
    return null
  }

  const [todayYear, todayMonth, todayDay] = todayIsoDate.split('-').map(Number)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  const difference = Math.floor((startUtc - todayUtc) / millisecondsPerDay)
  return difference > 0 ? difference : null
}

type OngoingProgress = {
  totalHours: number
  hoursLeft: number
  elapsedPercent: number
}

function getOngoingProgress(
  startDate: string | undefined,
  endDate: string | undefined,
  dayCount: number,
  nowDate: Date,
): OngoingProgress | null {
  if (!startDate || !endDate || dayCount <= 0) {
    return null
  }

  const start = parseIsoDate(startDate)
  const endExclusive = parseIsoDate(endDate)
  start.setHours(0, 0, 0, 0)
  endExclusive.setHours(0, 0, 0, 0)
  endExclusive.setDate(endExclusive.getDate() + 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return null
  }

  if (nowDate < start || nowDate >= endExclusive) {
    return null
  }

  const totalHours = dayCount * 24
  const millisecondsPerHour = 60 * 60 * 1000
  const rawHoursLeft = (endExclusive.getTime() - nowDate.getTime()) / millisecondsPerHour
  const hoursLeft = Math.max(0, Math.min(totalHours, Math.ceil(rawHoursLeft)))
  const elapsedHours = Math.max(0, totalHours - hoursLeft)
  const elapsedPercent = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  return {
    totalHours,
    hoursLeft,
    elapsedPercent,
  }
}

export function DashboardShellPage(): ReactElement {
  const { t, i18n } = useTranslation(['common', 'errors', 'ai-generation'])
  const displayName = useProfileStore((state) => state.displayName)
  const email = useProfileStore((state) => state.email)
  const name = displayName || email
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<ItinerarySummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSingleColumnList, setIsSingleColumnList] = useState(true)
  const listRef = useRef<HTMLElement | null>(null)
  const savedPrefs = useMemo(() => loadListingPrefs(), [])

  const normalizedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(normalizedPage) && normalizedPage >= 1 ? normalizedPage : 1
  const limit = parseOptionalPageSize(searchParams.get('limit')) ?? savedPrefs.limit
  const sortBy = parseOptionalSortBy(searchParams.get('sortBy')) ?? savedPrefs.sortBy
  const sortOrder = parseOptionalSortOrder(searchParams.get('sortOrder')) ?? savedPrefs.sortOrder
  const includePast = parseOptionalIncludePast(searchParams.get('includePast')) ?? savedPrefs.includePast
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const todayIsoDate = useMemo(() => getTodayIsoDate(), [])
  const nowDate = useMemo(() => new Date(), [])

  const setPage = useCallback(
    (nextPage: number): void => {
      const bounded = Math.max(1, nextPage)
      const next = new URLSearchParams(searchParams)
      next.set('page', String(bounded))
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const setLimit = useCallback(
    (nextLimit: PageSize): void => {
      const next = new URLSearchParams(searchParams)
      next.set('limit', String(nextLimit))
      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const setSortBy = useCallback(
    (nextSortBy: SortBy): void => {
      const next = new URLSearchParams(searchParams)
      next.set('sortBy', nextSortBy)
      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const setSortOrder = useCallback(
    (nextSortOrder: SortOrder): void => {
      const next = new URLSearchParams(searchParams)
      next.set('sortOrder', nextSortOrder)
      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const setIncludePast = useCallback(
    (nextIncludePast: boolean): void => {
      const next = new URLSearchParams(searchParams)
      next.set('includePast', String(nextIncludePast))
      next.set('page', '1')
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const fetchItems = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial'): Promise<void> => {
      if (mode === 'refresh') {
        setIsRefreshing(true)
      } else {
        setLoadState('loading')
      }

      try {
        const response = await listItineraries({
          page,
          limit,
          sortBy,
          sortOrder,
          includePast,
        })

        setItems(response.items)
        setTotal(response.total)

        const computedTotalPages = Math.max(1, Math.ceil(response.total / response.limit))
        if (response.page > computedTotalPages) {
          setPage(computedTotalPages)
          return
        }

        setLoadState('ready')
      } catch {
        setLoadState('error')
      } finally {
        setIsRefreshing(false)
      }
    },
    [includePast, limit, page, setPage, sortBy, sortOrder],
  )

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchItems('initial')
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [fetchItems])

  useEffect(() => {
    const currentPage = searchParams.get('page')
    const currentLimit = searchParams.get('limit')
    const currentSortBy = searchParams.get('sortBy')
    const currentSortOrder = searchParams.get('sortOrder')
    const currentIncludePast = searchParams.get('includePast')

    if (
      currentPage === String(page) &&
      currentLimit === String(limit) &&
      currentSortBy === sortBy &&
      currentSortOrder === sortOrder &&
      currentIncludePast === String(includePast)
    ) {
      return
    }

    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    next.set('limit', String(limit))
    next.set('sortBy', sortBy)
    next.set('sortOrder', sortOrder)
    next.set('includePast', String(includePast))
    setSearchParams(next, { replace: true })
  }, [includePast, limit, page, searchParams, setSearchParams, sortBy, sortOrder])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        LISTING_PREFS_STORAGE_KEY,
        JSON.stringify({ limit, sortBy, sortOrder, includePast }),
      )
    } catch {
      // Ignore localStorage failures (private mode/quota) and keep runtime behavior.
    }
  }, [includePast, limit, sortBy, sortOrder])

  useEffect(() => {
    if (loadState !== 'ready') {
      return
    }

    const listElement = listRef.current
    if (!listElement) {
      return
    }

    const updateColumnMode = (): void => {
      const cards = Array.from(
        listElement.querySelectorAll<HTMLElement>('[data-itinerary-card="true"]'),
      )

      if (cards.length < 2) {
        setIsSingleColumnList(true)
        return
      }

      const firstTop = cards[0].getBoundingClientRect().top
      const sameRowTolerancePx = 2
      const hasAnotherCardOnFirstRow = cards
        .slice(1)
        .some((card) => Math.abs(card.getBoundingClientRect().top - firstTop) <= sameRowTolerancePx)
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
  }, [includePast, items.length, loadState])

  const canGoPrev = page > 1 && !isRefreshing
  const canGoNext = page < totalPages && !isRefreshing
  const totalLabel = useMemo(
    () => t('common:dashboard.totalCount', { count: total }),
    [t, total],
  )
  const ongoingItems = useMemo(
    () => items.filter((item) => isOngoingItinerary(item, todayIsoDate)),
    [items, todayIsoDate],
  )
  const upcomingItems = useMemo(
    () => items.filter((item) => !isPastItinerary(item, todayIsoDate) && !isOngoingItinerary(item, todayIsoDate)),
    [items, todayIsoDate],
  )
  const pastItems = useMemo(
    () => items.filter((item) => isPastItinerary(item, todayIsoDate)),
    [items, todayIsoDate],
  )
  const renderCard = useCallback(
    (item: ItinerarySummary, itemIsPast: boolean): ReactElement => {
      const upcomingDaysLeft = getUpcomingDaysLeft(item.startDate, todayIsoDate)
      const ongoingProgress = getOngoingProgress(item.startDate, item.endDate, item.dayCount, nowDate)

      return (
        <article
          key={item.id}
          data-itinerary-card="true"
          className={`${styles.card} ${
            isSingleColumnList ? styles.cardSingleColumn : styles.cardMultiColumn
          } ${itemIsPast ? styles.cardPast : ''}`}
        >
          <Link
            to={`/itineraries/${item.id}`}
            className={styles.cardLink}
            aria-label={t('common:dashboard.openItineraryAria', {
              title: normalizeDisplayText(item.title),
            })}
          >
            {item.coverPhoto?.url ? (
              <img
                className={styles.cardCover}
                src={item.coverPhoto.url}
                alt={normalizeDisplayText(item.coverPhoto.caption ?? item.title)}
                title={normalizeDisplayText(item.coverPhoto.caption ?? item.title)}
                loading="lazy"
              />
            ) : (
              <div className={styles.cardCoverPlaceholder} aria-hidden="true">
                <svg className={styles.coverPlaceholderIcon} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 18L9 12L13 16L17 12L21 16V20H3V18Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 20V6C3 4.9 3.9 4 5 4H19C20.1 4 21 4.9 21 6V20"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>
            )}

            <div className={styles.cardBody}>
              <div className={styles.cardTitleRow}>
                <h2 className={styles.cardTitle}>{normalizeDisplayText(item.title)}</h2>
                {itemIsPast ? <span className={styles.pastBadge}>{t('common:dashboard.pastBadge')}</span> : null}
              </div>

              <div className={styles.cardDatesRow}>
                <p className={styles.cardDates}>
                  {formatDateRange(
                    item.startDate,
                    item.endDate,
                    i18n.language,
                    t('common:dashboard.noDate'),
                  )}
                </p>

                <div className={styles.cardMetrics}>
                  <span className={styles.cardDays}>
                    {t('common:dashboard.days', { count: item.dayCount })}
                  </span>
                  {upcomingDaysLeft ? (
                    <span className={styles.upcomingDaysLeftBadge}>
                      {t('common:dashboard.daysLeft', { count: upcomingDaysLeft })}
                    </span>
                  ) : null}
                </div>
              </div>

              {ongoingProgress ? (
                <div className={styles.ongoingProgress}>
                  <div className={styles.ongoingProgressMeta}>
                    <span className={styles.ongoingProgressLabel}>{t('common:dashboard.ongoingProgress')}</span>
                  </div>
                  <div
                    className={styles.ongoingProgressTrack}
                    role="progressbar"
                    aria-label={t('common:dashboard.ongoingProgress')}
                    aria-valuemin={0}
                    aria-valuemax={ongoingProgress.totalHours}
                    aria-valuenow={ongoingProgress.hoursLeft}
                    aria-valuetext={t('common:dashboard.hoursLeft', { count: ongoingProgress.hoursLeft })}
                  >
                    <div
                      className={styles.ongoingProgressFill}
                      style={{ width: `${ongoingProgress.elapsedPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {item.tags.length > 0 ? (
                <div className={styles.tagsRow}>
                  <svg className={styles.tagsIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 10L13 3H6L3 6V13L10 20L20 10Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="7.8" cy="7.8" r="1.6" fill="currentColor" />
                  </svg>
                  <div className={styles.tags}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {normalizeDisplayText(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Link>
        </article>
      )
    },
    [i18n.language, isSingleColumnList, nowDate, t, todayIsoDate],
  )

  return (
    <AppShell>
      <div className={styles.page}>
        <CommonListingHeader
          kicker={t('common:dashboard.kicker')}
          title={name ? t('common:dashboard.titleWithName', { name }) : t('common:dashboard.title')}
          subtitle={totalLabel}
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
                <label className={`${styles.controlGroup} ${styles.includePastGroup}`}>
                  <span className={styles.controlLabel}>{t('common:dashboard.showPastLabel')}</span>
                  <span className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      className={styles.controlCheckbox}
                      checked={includePast}
                      onChange={(event) => {
                        setIncludePast(event.target.checked)
                      }}
                      disabled={isRefreshing || loadState === 'loading'}
                    />
                    <span className={styles.checkboxText}>{t('common:dashboard.showPast')}</span>
                  </span>
                </label>

                <label className={styles.controlGroup}>
                  <span className={styles.controlLabel}>{t('common:dashboard.pageSizeLabel')}</span>
                  <select
                    className={`${styles.controlSelect} ${styles.pageSizeSelect}`}
                    value={String(limit)}
                    onChange={(event) => {
                      const nextLimit = Number.parseInt(event.target.value, 10)
                      if (PAGE_SIZE_OPTIONS.includes(nextLimit as PageSize)) {
                        setLimit(nextLimit as PageSize)
                      }
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
                      setSortBy(event.target.value as SortBy)
                    }}
                    disabled={isRefreshing || loadState === 'loading'}
                  >
                    <option value="plannedStartDate">{t('common:dashboard.sortByPlannedStartDate')}</option>
                    <option value="createdAt">{t('common:dashboard.sortByCreatedAt')}</option>
                    <option value="dayCount">{t('common:dashboard.sortByDayCount')}</option>
                    <option value="updatedAt">{t('common:dashboard.sortByUpdatedAt')}</option>
                  </select>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.sortOrderButton}
                  onClick={() => {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  disabled={isRefreshing || loadState === 'loading'}
                  aria-label={
                    sortOrder === 'asc' ? t('common:dashboard.sortAsc') : t('common:dashboard.sortDesc')
                  }
                  title={
                    sortOrder === 'asc' ? t('common:dashboard.sortAsc') : t('common:dashboard.sortDesc')
                  }
                >
                  <svg
                    className={styles.sortGlyph}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
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

        {loadState === 'loading' || loadState === 'idle' ? (
          <CommonListingStateCard>
            <p>{t('common:loading')}</p>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'error' ? (
          <CommonListingStateCard>
            <p className={styles.errorText}>{t('errors:server')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchItems('initial')
              }}
            >
              <RefreshCw aria-hidden="true" />
              {t('common:dashboard.retry')}
            </Button>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'ready' && items.length === 0 ? (
          <CommonListingStateCard>
            <p>{t('common:dashboard.empty')}</p>
          </CommonListingStateCard>
        ) : null}

        {loadState === 'ready' && items.length > 0 ? (
          <>
            <section
              ref={listRef}
              className={`${styles.list} ${
                isSingleColumnList ? styles.listSingleColumn : styles.listMultiColumn
              }`}
            >
              {includePast ? (
                <>
                  {ongoingItems.length > 0 ? (
                    <Fragment key="dashboard-ongoing">
                      <h2 className={styles.bucketHeader}>{t('common:dashboard.ongoingTripsHeader')}</h2>
                      {ongoingItems.map((item) => renderCard(item, false))}
                    </Fragment>
                  ) : null}
                  {upcomingItems.length > 0 ? (
                    <Fragment key="dashboard-upcoming">
                      <h2 className={styles.bucketHeader}>{t('common:dashboard.upcomingTripsHeader')}</h2>
                      {upcomingItems.map((item) => renderCard(item, false))}
                    </Fragment>
                  ) : null}
                  {pastItems.length > 0 ? (
                    <Fragment key="dashboard-past">
                      <h2 className={styles.bucketHeader}>{t('common:dashboard.pastTripsHeader')}</h2>
                      {pastItems.map((item) => renderCard(item, true))}
                    </Fragment>
                  ) : null}
                </>
              ) : (
                items.map((item) => renderCard(item, false))
              )}
            </section>

            <CommonListingPagination
              totalPages={totalPages}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={() => {
                setPage(page - 1)
              }}
              onNext={() => {
                setPage(page + 1)
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
