import type { ReactElement, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import styles from './CommonListing.module.css'

type ControlsAlign = 'start' | 'end'

type CommonListingHeaderProps = {
  kicker: string
  title: string
  subtitle?: string
  actions?: ReactNode
  controls?: ReactNode
  controlsAlign?: ControlsAlign
  className?: string
}

type CommonListingStateCardProps = {
  children: ReactNode
  className?: string
}

type CommonListingPaginationProps = {
  totalPages: number
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  previousLabel: string
  nextLabel: string
  pageLabel: string
  ariaLabel: string
  className?: string
}

export function CommonListingHeader({
  kicker,
  title,
  subtitle,
  actions,
  controls,
  controlsAlign = 'end',
  className,
}: CommonListingHeaderProps): ReactElement {
  return (
    <section className={cn(styles.headerCard, className)}>
      <div className={styles.headerText}>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>

      {actions ? <div className={styles.headerActions}>{actions}</div> : null}

      {controls ? (
        <>
          <div className={styles.headerDivider} aria-hidden="true" />
          <div
            className={cn(
              styles.headerControlsRow,
              controlsAlign === 'start' ? styles.controlsStart : styles.controlsEnd,
            )}
          >
            {controls}
          </div>
        </>
      ) : null}
    </section>
  )
}

export function CommonListingStateCard({ children, className }: CommonListingStateCardProps): ReactElement {
  return <section className={cn(styles.stateCard, className)}>{children}</section>
}

export function CommonListingPagination({
  totalPages,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  previousLabel,
  nextLabel,
  pageLabel,
  ariaLabel,
  className,
}: CommonListingPaginationProps): ReactElement | null {
  if (totalPages <= 1) {
    return null
  }

  return (
    <section className={cn(styles.pagination, className)} aria-label={ariaLabel}>
      <Button type="button" variant="outline" size="sm" disabled={!canGoPrev} onClick={onPrev}>
        {previousLabel}
      </Button>
      <p className={styles.pageLabel}>{pageLabel}</p>
      <Button type="button" variant="outline" size="sm" disabled={!canGoNext} onClick={onNext}>
        {nextLabel}
      </Button>
    </section>
  )
}
