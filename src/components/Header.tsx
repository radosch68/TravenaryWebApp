import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { BrandLanguageHeader } from '@/components/BrandLanguageHeader'
import { signOut } from '@/services/auth-service'
import { useAuthStore } from '@/store/auth-store'
import { useProfileStore } from '@/store/profile-store'

export function Header(): ReactElement {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'common', 'profile'])
  const clearSession = useAuthStore((state) => state.clearSession)
  const profile = useProfileStore((state) => state.profile)
  const avatarUrl = profile?.avatarUrl
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
      <BrandLanguageHeader brandLinkTo="/" variant="topbar" />
      <div className="topbar__menu" ref={menuRef}>
        <button
          type="button"
          className="user-menu__trigger"
          aria-expanded={menuOpen}
          aria-label={t('common:avatarAriaLabel')}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <svg className="user-menu__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M5 19C5.75 15.9 8.5 14 12 14C15.5 14 18.25 15.9 19 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {avatarUrl ? (
            <img
              className="user-menu__avatar"
              src={avatarUrl}
              alt={t('common:avatarAlt')}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
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
