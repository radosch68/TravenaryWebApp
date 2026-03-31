import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { DashboardPaginationBar } from '@/components/DashboardPaginationBar'
import { ItineraryList } from '@/components/itinerary/ItineraryList'
import { GenerationModal } from '@/components/itinerary/GenerationModal'
import { createItineraryFromTemplate, listItineraries } from '@/services/itinerary-service'
import type { ItinerarySummary } from '@/services/contracts'
import { useProfileStore } from '@/store/profile-store'

const ITINERARY_PAGE_SIZE = 12

export function HomePage(): ReactElement {
  const { t } = useTranslation(['common', 'ai-generation'])
  const profile = useProfileStore((state) => state.profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<ItinerarySummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false)
  const [createError, setCreateError] = useState(false)
  const normalizedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(normalizedPage) && normalizedPage >= 1 ? normalizedPage : 1
  const totalPages = Math.max(1, Math.ceil(total / ITINERARY_PAGE_SIZE))
  const showCornerPagination = loadState === 'ready' && totalPages > 1

  const setPage = useCallback(
    (nextPage: number): void => {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('page', String(Math.max(1, nextPage)))
      setSearchParams(nextSearchParams)
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    const currentPage = searchParams.get('page')
    if (currentPage === String(page)) {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('page', String(page))
    setSearchParams(nextSearchParams, { replace: true })
  }, [page, searchParams, setSearchParams])

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    try {
      const response = await listItineraries({
        page,
        limit: ITINERARY_PAGE_SIZE,
        sortBy: 'plannedStartDate',
        sortOrder: 'asc',
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
    }
  }, [page, setPage])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchItems()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [fetchItems])

  const handleCreate = async (): Promise<void> => {
    setCreateError(false)
    try {
      await createItineraryFromTemplate()
      await fetchItems()
    } catch {
      setCreateError(true)
    }
  }

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb items={[{ icon: 'home', ariaLabel: t('common:navigation.dashboard'), to: '/?page=1' }]} />
      <section className="home-panel home-panel--dashboard">
        <div className="dashboard-content-padding">
          <h1>{profile?.displayName || profile?.email}</h1>
          <div className="dashboard-actions">
            <h2 className="dashboard-actions__heading">
              {t('common:itinerary.itineraries', { count: total })}
            </h2>
            <button
              type="button"
              onClick={() => setIsGenerationModalOpen(true)}
              className="dashboard-actions__add-button"
              aria-label={t('common:createItinerary')}
            >
              +
            </button>
          </div>

        </div>
        <div className="dashboard-list-shell">

          {loadState === 'loading' || loadState === 'idle' ? (
            <p className="dashboard-list-shell__state">{t('common:itinerary.loading')}</p>
          ) : null}

          {loadState === 'error' ? (
            <p className="dashboard-list-shell__state error">
              {t('common:itinerary.loadError')}{' '}
              <button type="button" onClick={() => void fetchItems()}>
                {t('common:itinerary.retry')}
              </button>
            </p>
          ) : null}

          {createError ? (
            <p className="dashboard-list-shell__state error">
              {t('common:itinerary.createError')}{' '}
              <button type="button" onClick={() => void handleCreate()}>
                {t('common:itinerary.retry')}
              </button>
            </p>
          ) : null}

          {loadState === 'ready' && items.length === 0 ? (
            <p className="dashboard-list-shell__state">{t('common:itinerary.empty')}</p>
          ) : null}

          {showCornerPagination ? (
            <DashboardPaginationBar
              page={page}
              totalPages={totalPages}
              onSetPage={setPage}
              disabled={false}
              position="top"
            />
          ) : null}

          {loadState === 'ready' && items.length > 0 ? <ItineraryList items={items} /> : null}

          {showCornerPagination ? (
            <DashboardPaginationBar
              page={page}
              totalPages={totalPages}
              onSetPage={setPage}
              disabled={false}
              position="bottom"
            />
          ) : null}
        </div>
      </section>

      {isGenerationModalOpen ? (
        <GenerationModal
          onClose={() => {
            setIsGenerationModalOpen(false)
            void fetchItems()
          }}
          onFallback={() => {
            setIsGenerationModalOpen(false)
            void handleCreate()
          }}
        />
      ) : null}
    </main>
  )
}
