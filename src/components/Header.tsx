import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandBanner } from '@/components/BrandBanner'
import { signOut } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'

export function Header(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'common'])
  const clearSession = useAuthStore((state) => state.clearSession)
  const [isBusy, setIsBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      if (!menuRef.current) {
        return
      }

      const target = event.target as Node | null
      if (target && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleSignOut = async (): Promise<void> => {
    setIsBusy(true)
    try {
      await signOut()
    } finally {
      clearSession()
      setIsBusy(false)
      setMenuOpen(false)
      navigate('/signin')
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Link to="/" aria-label={t('common:navigation.goToDashboard')}>
          <BrandBanner />
        </Link>
      </div>
      <div className="topbar__menu" ref={menuRef}>
        <button
          type="button"
          className="user-menu__trigger"
          aria-expanded={menuOpen}
          aria-label={t('profile:title')}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M5 19C5.75 15.9 8.5 14 12 14C15.5 14 18.25 15.9 19 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {menuOpen ? (
          <div className="user-menu__panel">
            <Link to="/profile" className="user-menu__item" onClick={() => setMenuOpen(false)}>
              {t('profile:title')}
            </Link>
            <button
              type="button"
              className="user-menu__item user-menu__item--danger"
              onClick={() => void handleSignOut()}
              disabled={isBusy}
            >
              {isBusy ? t('common:loading') : t('auth:signOut')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
