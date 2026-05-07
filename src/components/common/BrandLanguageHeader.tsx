import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'

import { LanguageSelector } from '@/components/common/LanguageSelector'

import styles from './BrandLanguageHeader.module.css'

interface BrandLanguageHeaderProps {
  brandLinkTo?: string
}

export function BrandLanguageHeader({ brandLinkTo }: BrandLanguageHeaderProps): ReactElement {
  const brand = brandLinkTo ? (
    <Link className={styles.brand} to={brandLinkTo}>
      Travenary
    </Link>
  ) : (
    <span className={styles.brand}>Travenary</span>
  )

  return (
    <div className={styles.header}>
      {brand}
      <LanguageSelector />
    </div>
  )
}
