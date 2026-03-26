import type { ReactElement } from 'react'

interface BrandBannerProps {
  compact?: boolean
}

export function BrandBanner({ compact = false }: BrandBannerProps): ReactElement {
  return (
    <div className={compact ? 'brand-banner brand-banner--compact' : 'brand-banner'}>
      <div className="brand-banner__text">Travenary</div>
      {!compact && (
        <div className="brand-banner__deco" aria-hidden="true">
          <svg
            viewBox="0 0 400 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Far mountain range */}
            <path
              d="M0 56 L0 40 L30 28 L55 38 L80 18 L108 34 L133 8 L158 26 L182 12 L214 28 L244 5 L272 22 L304 10 L333 26 L362 9 L400 20 L400 56 Z"
              fill="rgba(15,127,105,0.065)"
            />
            {/* Near mountain range */}
            <path
              d="M110 56 L110 45 L152 33 L190 47 L228 26 L264 43 L302 28 L342 44 L382 20 L400 30 L400 56 Z"
              fill="rgba(15,127,105,0.115)"
            />
            {/* Sun */}
            <circle cx="362" cy="13" r="11" fill="rgba(255,195,50,0.20)" />
            <circle cx="362" cy="13" r="7" fill="rgba(255,215,70,0.36)" />
            {/* Flight path arc */}
            <path
              d="M 38 50 Q 188 1 332 44"
              stroke="rgba(15,127,105,0.30)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            {/* Departure marker */}
            <circle cx="38" cy="50" r="4" fill="rgba(15,127,105,0.40)" />
            {/* Arrival pin */}
            <path
              d="M 332 29 C 329 29 327 31 327 33 C 327 36 332 44 332 44 C 332 44 337 36 337 33 C 337 31 335 29 332 29 Z"
              fill="rgba(15,127,105,0.65)"
            />
            <circle cx="332" cy="34" r="2" fill="rgba(255,255,255,0.90)" />
          </svg>
        </div>
      )}
    </div>
  )
}
