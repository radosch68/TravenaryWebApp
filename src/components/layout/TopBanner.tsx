import { Maximize, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactElement, TouchEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import travenaryLogoDark from '@/assets/travenary-logo-backpackers-dark.png'
import travenaryLogo from '@/assets/travenary-logo-backpackers.png'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'

import styles from './TopBanner.module.css'

const HIDDEN_STORAGE_KEY = 'travenary.topBannerHidden'
const SWIPE_UP_HIDE_THRESHOLD_PX = 30
const SWIPE_AXIS_TOLERANCE_PX = 8

const PUBLIC_AUTH_ROUTES = new Set(['/signin', '/signup', '/link-provider'])

function isBannerInitiallyHidden(): boolean {
  return localStorage.getItem(HIDDEN_STORAGE_KEY) === 'true'
}

export function TopBanner(): ReactElement | null {
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const { t } = useTranslation(['auth', 'common'])
  const accessToken = useAuthStore((state) => state.accessToken)
  const signOut = useAuthStore((state) => state.signOut)

  const [isHidden, setIsHidden] = useState<boolean>(isBannerInitiallyHidden)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const hiddenRevealArmedRef = useRef(false)
  const swipeStartXRef = useRef<number | null>(null)
  const swipeStartYRef = useRef<number | null>(null)
  const swipeHandledRef = useRef(false)

  const isPublicAuthRoute = useMemo(
    () => PUBLIC_AUTH_ROUTES.has(location.pathname),
    [location.pathname],
  )

  const showAuthedActions = Boolean(accessToken) && !isPublicAuthRoute

  useEffect(() => {
    if (!isHidden) {
      return
    }

    const revealWhenAtTop = (): void => {
      if (window.scrollY > 1) {
        hiddenRevealArmedRef.current = true
        return
      }

      if (hiddenRevealArmedRef.current) {
        setIsHidden(false)
        hiddenRevealArmedRef.current = false
        localStorage.setItem(HIDDEN_STORAGE_KEY, 'false')
      }
    }

    window.addEventListener('scroll', revealWhenAtTop, { passive: true })
    revealWhenAtTop()

    return () => {
      window.removeEventListener('scroll', revealWhenAtTop)
    }
  }, [isHidden])

  async function onSignOut(): Promise<void> {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/signin')
    } finally {
      setIsSigningOut(false)
    }
  }

  function onHide(): void {
    hiddenRevealArmedRef.current = window.scrollY > 1
    setIsHidden(true)
    localStorage.setItem(HIDDEN_STORAGE_KEY, 'true')
  }

  function onTouchStart(event: TouchEvent<HTMLElement>): void {
    if (isHidden) {
      return
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    swipeStartXRef.current = touch.clientX
    swipeStartYRef.current = touch.clientY
    swipeHandledRef.current = false
  }

  function onTouchMove(event: TouchEvent<HTMLElement>): void {
    if (isHidden || swipeHandledRef.current) {
      return
    }

    const startX = swipeStartXRef.current
    const startY = swipeStartYRef.current
    const touch = event.touches[0]
    if (startX === null || startY === null || !touch) {
      return
    }

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const isUpwardSwipe =
      deltaY <= -SWIPE_UP_HIDE_THRESHOLD_PX &&
      Math.abs(deltaY) > Math.abs(deltaX) + SWIPE_AXIS_TOLERANCE_PX

    if (isUpwardSwipe) {
      swipeHandledRef.current = true
      onHide()
    }
  }

  function onTouchEnd(): void {
    swipeStartXRef.current = null
    swipeStartYRef.current = null
    swipeHandledRef.current = false
  }

  const brandTo = showAuthedActions ? '/' : '/signin'
  const logoSrc = resolvedTheme === 'dark' ? travenaryLogoDark : travenaryLogo

  return (
    <header
      className={styles.banner}
      data-hidden={isHidden ? 'true' : 'false'}
      aria-hidden={isHidden}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className={styles.inner}>
        <Link className={styles.brand} to={brandTo}>
          <img src={logoSrc} alt={t('common:brand.logoAlt')} className={styles.logo} />
        </Link>

        <div className={styles.actions}>
          <div className={styles.languageGroup}>
            <LanguageSelector className={styles.languageSelect} />
          </div>

          {showAuthedActions ? (
            <div className={styles.accountGroup}>
              <ThemeToggle className={styles.actionButton} />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.actionButton}
                onClick={() => {
                  void onSignOut()
                }}
                disabled={isSigningOut}
                aria-label={isSigningOut ? t('auth:actions.signingOut') : t('auth:signOut')}
                title={isSigningOut ? t('auth:actions.signingOut') : t('auth:signOut')}
              >
                <LogOut aria-hidden="true" />
                <span className={styles.actionLabel}>
                  {isSigningOut ? t('auth:actions.signingOut') : t('auth:signOut')}
                </span>
              </Button>
            </div>
          ) : null}

          <div className={styles.screenGroup}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.actionButton}
              onClick={onHide}
              aria-label={t('common:banner.hide')}
              title={t('common:banner.hide')}
            >
              <Maximize aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}