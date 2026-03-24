import type { ReactElement } from 'react'

interface GithubSignInButtonProps {
  onClick: () => Promise<void>
  label: string
}

export function GithubSignInButton({ onClick, label }: GithubSignInButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="social-provider-btn social-provider-btn--github"
      onClick={() => void onClick()}
    >
      <span className="social-provider-btn__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" focusable="false">
          <path
            fill="currentColor"
            d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.05-1.42-4.05-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.1-.74.08-.72.08-.72 1.21.09 1.86 1.25 1.86 1.25 1.08 1.84 2.84 1.31 3.54 1 .11-.79.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.97 0-1.32.47-2.39 1.24-3.24-.12-.31-.54-1.53.12-3.2 0 0 1.01-.32 3.3 1.24a11.44 11.44 0 0 1 6 0c2.29-1.56 3.3-1.24 3.3-1.24.66 1.67.24 2.89.12 3.2.77.85 1.24 1.92 1.24 3.24 0 4.64-2.81 5.66-5.49 5.96.43.38.82 1.11.82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"
          />
        </svg>
      </span>
      <span className="social-provider-btn__label">{label}</span>
    </button>
  )
}
