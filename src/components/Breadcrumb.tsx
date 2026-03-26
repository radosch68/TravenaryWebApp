import type { ReactElement, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export interface BreadcrumbItem {
  label?: ReactNode
  icon?: 'home'
  ariaLabel?: string
  to?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

function BreadcrumbIcon({ icon }: { icon: NonNullable<BreadcrumbItem['icon']> }): ReactElement {
  if (icon === 'home') {
    return (
      <svg className="breadcrumb__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M4 10.5L12 4L20 10.5V19C20 19.5523 19.5523 20 19 20H15V14H9V20H5C4.44772 20 4 19.5523 4 19V10.5Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return <></>
}

export function Breadcrumb({ items }: BreadcrumbProps): ReactElement | null {
  const { t } = useTranslation(['common'])

  if (items.length === 0) {
    return null
  }

  return (
    <nav className="breadcrumb" aria-label={t('common:navigation.breadcrumb')}>
      <ol className="breadcrumb__list">
        {items.map((item, index) => (
          <li key={index} className="breadcrumb__item">
            {item.to ? (
              <Link
                to={item.to}
                className={item.icon ? 'breadcrumb__link breadcrumb__link--icon' : 'breadcrumb__link'}
                aria-label={item.ariaLabel}
              >
                {item.icon ? <BreadcrumbIcon icon={item.icon} /> : item.label}
              </Link>
            ) : (
              <span
                className={item.icon ? 'breadcrumb__text breadcrumb__text--icon' : 'breadcrumb__text'}
                aria-current="page"
                aria-label={item.ariaLabel}
              >
                {item.icon ? <BreadcrumbIcon icon={item.icon} /> : item.label}
              </span>
            )}
            {index < items.length - 1 && <span className="breadcrumb__separator" aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
