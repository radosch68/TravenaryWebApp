import type { ReactElement, ReactNode } from 'react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import styles from './DialogShell.module.css'

interface DialogShellProps {
  title: ReactNode
  onClose: () => void
  footer?: ReactNode | null
  headerExtra?: ReactNode | null
  headerLeft?: ReactNode | null
  children: ReactNode
  className?: string
  bodyClassName?: string
  ariaLabel?: string
  closeLabel?: string
  closeOnOverlayClick?: boolean
}

export function DialogShell({
  title,
  onClose,
  footer,
  headerExtra,
  headerLeft,
  children,
  className,
  bodyClassName,
  ariaLabel,
  closeLabel,
  closeOnOverlayClick = true,
}: DialogShellProps): ReactElement {
  const { t } = useTranslation(['common'])
  const titleId = useId()

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const dialog = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      onMouseDown={(event) => {
        if (!closeOnOverlayClick || event.target !== event.currentTarget) {
          return
        }

        onClose()
      }}
    >
      <div className={`${styles.modal}${className ? ` ${className}` : ''}`}>
        <div className={styles.header}>
          <div className={`${styles.headerTitleRow}${headerLeft != null ? ` ${styles.headerTitleRowCentered}` : ''}`}>
            {headerLeft != null ? <div className={styles.headerLeft}>{headerLeft}</div> : null}
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label={closeLabel ?? t('common:close')}
            >
              <X size={18} />
            </button>
          </div>
          {headerExtra != null ? <div className={styles.headerExtra}>{headerExtra}</div> : null}
        </div>

        <div className={`${styles.body}${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>

        {footer != null ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )

  // Render outside any contenteditable ancestor (e.g. tiptap node views):
  // inside one, iOS Safari treats dialog buttons as editable text and shows
  // the selection callout instead of clicking them.
  if (typeof document === 'undefined') {
    return dialog
  }

  return createPortal(dialog, document.body)
}
