import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createShareLink, revokeShareLink } from '@/services/itinerary-service'

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy selection-based copy path.
    }
  }

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

interface ShareButtonProps {
  itineraryId: string
  hasShareLink: boolean
  onShareChange: (hasShareLink: boolean) => void
}

export function ShareButton({
  itineraryId,
  hasShareLink,
  onShareChange,
}: ShareButtonProps): ReactElement {
  const { t } = useTranslation(['common'])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
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
    if (!popoverOpen) return

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

  const handleCreate = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await createShareLink(itineraryId)
      setShareUrl(response.shareUrl)
      onShareChange(true)
    } catch {
      setError(t('common:itinerary.share.shareError'))
    } finally {
      setBusy(false)
    }
  }, [itineraryId, onShareChange, t])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
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

    setError(t('common:itinerary.share.copyError'))
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
      setError(t('common:itinerary.share.revokeError'))
    } finally {
      setBusy(false)
    }
  }, [itineraryId, onShareChange, t])

  return (
    <div className="share-button-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className="share-button"
        onClick={() => setPopoverOpen((prev) => !prev)}
        aria-label={t('common:itinerary.share.title')}
        title={t('common:itinerary.share.title')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      {popoverOpen ? (
        <div ref={popoverRef} className="share-popover" role="dialog" aria-modal="false">
          <p className="share-popover__status">
            {hasShareLink
              ? t('common:itinerary.share.linkActive')
              : t('common:itinerary.share.linkInactive')}
          </p>

          {!hasShareLink ? (
            <button
              type="button"
              className="share-popover__action"
              onClick={() => void handleCreate()}
              disabled={busy}
            >
              {t('common:itinerary.share.createLink')}
            </button>
          ) : (
            <>
              {shareUrl ? (
                <button
                  type="button"
                  className="share-popover__action"
                  onClick={() => void handleCopy()}
                  disabled={busy}
                >
                  {copied
                    ? t('common:itinerary.share.linkCopied')
                    : t('common:itinerary.share.copyLink')}
                </button>
              ) : (
                <button
                  type="button"
                  className="share-popover__action"
                  onClick={() => {
                    if (window.confirm(t('common:itinerary.share.regenerateConfirm'))) {
                      void handleCreate()
                    }
                  }}
                  disabled={busy}
                >
                  {t('common:itinerary.share.regenerateLink')}
                </button>
              )}
              <button
                type="button"
                className="share-popover__action share-popover__action--danger"
                onClick={() => void handleRevoke()}
                disabled={busy}
              >
                {t('common:itinerary.share.revokeLink')}
              </button>
            </>
          )}

          {error ? <p className="share-popover__error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
