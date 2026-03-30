import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandBanner } from '@/components/BrandBanner'
import { LanguageSelector } from '@/components/LanguageSelector'

interface BrandLanguageHeaderProps {
  brandLinkTo?: string
  variant?: 'auth' | 'topbar'
}

export function BrandLanguageHeader({
  brandLinkTo,
  variant = 'auth',
}: BrandLanguageHeaderProps): ReactElement {
  const { t } = useTranslation(['common'])
  const containerClassName =
    variant === 'topbar'
      ? 'brand-language-header brand-language-header--topbar'
      : 'brand-language-header brand-language-header--auth'

  return (
    <div className={containerClassName}>
      <div className="brand-language-header__brand">
        {brandLinkTo ? (
          <Link to={brandLinkTo} aria-label={t('common:navigation.goToDashboard')}>
            <BrandBanner />
          </Link>
        ) : (
          <BrandBanner />
        )}
      </div>
      <div className="brand-language-header__language">
        <LanguageSelector className="language-selector" />
      </div>
    </div>
  )
}