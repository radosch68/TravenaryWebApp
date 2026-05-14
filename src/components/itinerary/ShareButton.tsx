import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createShareLink, getShareLink, revokeShareLink } from '@/services/itinerary-service'

import styles from './ShareButton.module.css'

function copyTextToClipboardLegacy(text: string): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  textArea.style.left = '-9999px'
  textArea.style.top = '0'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  textArea.setSelectionRange(0, text.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textArea)
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to legacy copy path for stricter browser environments.
    }
  }

  return copyTextToClipboardLegacy(text)
}

interface ShareButtonProps {
  itineraryId: string
  hasShareLink: boolean
  onShareChange: (hasShareLink: boolean) => void
}

export function ShareButton({ itineraryId, hasShareLink, onShareChange }: ShareButtonProps): ReactElement {
  const { t } = useTranslation('common')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [loadingShareUrl, setLoadingShareUrl] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()

  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const copiedResetTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!popoverOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setPopoverOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen || !hasShareLink || shareUrl) {
      return
    }

    let ignoreResult = false

    async function loadShareUrl(): Promise<void> {
      setLoadingShareUrl(true)
      setError(undefined)

      try {
        const response = await getShareLink(itineraryId)
        if (!ignoreResult) {
          setShareUrl(response.shareUrl)
        }
      } catch {
        if (!ignoreResult) {
          setError(t('itineraryView.shareLoadError'))
        }
      } finally {
        if (!ignoreResult) {
          setLoadingShareUrl(false)
        }
      }
    }

    void loadShareUrl()

    return () => {
      ignoreResult = true
    }
  }, [hasShareLink, itineraryId, popoverOpen, shareUrl, t])

  const handleCreate = useCallback(async () => {
    setBusy(true)
    setError(undefined)

    try {
      const response = await createShareLink(itineraryId)
      setShareUrl(response.shareUrl)
      onShareChange(true)
    } catch {
      setError(t('itineraryView.shareCreateError'))
    } finally {
      setBusy(false)
    }
  }, [itineraryId, onShareChange, t])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) {
      return
    }

    setError(undefined)

    const copiedSuccessfully = await copyTextToClipboard(shareUrl)
    if (copiedSuccessfully) {
      setCopied(true)
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current)
      }

      copiedResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copiedResetTimeoutRef.current = null
      }, 2000)
      return
    }

    setError(t('itineraryView.shareCopyError'))
  }, [shareUrl, t])

  const handleRevoke = useCallback(async () => {
    setBusy(true)
    setError(undefined)

    try {
      await revokeShareLink(itineraryId)
      setShareUrl(undefined)
      setCopied(false)
      onShareChange(false)
    } catch {
      setError(t('itineraryView.shareRevokeError'))
    } finally {
      setBusy(false)
    }
  }, [itineraryId, onShareChange, t])

  return (
    <div className={styles.wrapper}>
      <button
        ref={buttonRef}
        type="button"
        className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), styles.trigger)}
        onClick={() => {
          setPopoverOpen((previousValue) => !previousValue)
        }}
        aria-label={t('itineraryView.shareTitle')}
        title={t('itineraryView.shareTitle')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      {popoverOpen ? (
        <div ref={popoverRef} className={styles.popover} role="dialog" aria-modal="false">
          <p className={styles.status}>
            {hasShareLink ? t('itineraryView.shareLinkActive') : t('itineraryView.shareLinkInactive')}
          </p>

          {!hasShareLink ? (
            <button type="button" className={styles.action} onClick={() => void handleCreate()} disabled={busy}>
              {t('itineraryView.createShareLink')}
            </button>
          ) : (
            <>
              {shareUrl ? (
                <button type="button" className={styles.action} onClick={() => void handleCopy()} disabled={busy}>
                  {copied ? t('itineraryView.shareLinkCopied') : t('itineraryView.copyShareLink')}
                </button>
              ) : loadingShareUrl ? (
                <button type="button" className={styles.action} disabled>
                  {t('itineraryView.shareLoadingLink')}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    if (window.confirm(t('itineraryView.shareRegenerateConfirm'))) {
                      void handleCreate()
                    }
                  }}
                  disabled={busy}
                >
                  {t('itineraryView.shareRegenerateLink')}
                </button>
              )}

              <button
                type="button"
                className={`${styles.action} ${styles.actionDanger}`}
                onClick={() => void handleRevoke()}
                disabled={busy}
              >
                {t('itineraryView.shareRevokeLink')}
              </button>
            </>
          )}

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
