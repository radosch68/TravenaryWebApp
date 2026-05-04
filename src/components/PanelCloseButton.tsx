import type { ReactElement } from 'react'

interface PanelCloseButtonProps {
  ariaLabel: string
  onClick: () => void
}

export function PanelCloseButton({ ariaLabel, onClick }: PanelCloseButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="panel-close-button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
    >
      <CloseIcon />
    </button>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
