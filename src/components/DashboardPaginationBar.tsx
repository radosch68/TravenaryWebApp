import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

interface DashboardPaginationBarProps {
  page: number
  totalPages: number
  onSetPage: (page: number) => void
  disabled?: boolean
  position?: 'top' | 'bottom'
  labelKey?: string
  ariaLabelKey?: string
}

export function DashboardPaginationBar({
  page,
  totalPages,
  onSetPage,
  disabled = false,
  position = 'top',
  labelKey = 'common:itinerary.pagination.pageIndicator',
  ariaLabelKey = 'common:itinerary.pagination.ariaLabel',
}: DashboardPaginationBarProps): ReactElement {
  const { t } = useTranslation()

  return (
    <nav
      className={`dashboard-pagination-bar dashboard-pagination-bar--${position}`}
      aria-label={t(ariaLabelKey)}
    >
      <button
        className="dashboard-pagination-bar__button dashboard-pagination-bar__button--prev"
        type="button"
        onClick={() => onSetPage(page - 1)}
        aria-label={t('common:itinerary.pagination.previous')}
        disabled={disabled || page <= 1}
      />

      <span className="dashboard-pagination-bar__indicator">
        {t(labelKey, {
          page,
          totalPages,
          current: page,
          total: totalPages,
        })}
      </span>

      <button
        className="dashboard-pagination-bar__button dashboard-pagination-bar__button--next"
        type="button"
        onClick={() => onSetPage(page + 1)}
        aria-label={t('common:itinerary.pagination.next')}
        disabled={disabled || page >= totalPages}
      />
    </nav>
  )
}
