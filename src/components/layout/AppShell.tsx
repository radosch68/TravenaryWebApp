import {
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  Info,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import styles from './AppShell.module.css'

const MENU_HIDDEN_STORAGE_KEY = 'travenary.mainMenuHidden'

function isMenuInitiallyHidden(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(MENU_HIDDEN_STORAGE_KEY) === 'true'
}

function persistMenuHiddenState(isHidden: boolean): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(MENU_HIDDEN_STORAGE_KEY, isHidden ? 'true' : 'false')
}

type AppShellProps = {
  children: ReactNode
}

const navItems = [
  { key: 'about', icon: Info, to: '/about' },
  { key: 'dashboard', icon: LayoutDashboard, to: '/' },
  { key: 'itineraries', icon: ListTodo, to: '/itineraries' },
  { key: 'aiDrafts', icon: Sparkles, to: '/ai-drafts' },
  { key: 'profile', icon: UserRound, to: '/profile' },
  { key: 'settings', icon: Settings, to: '/settings' },
] as const satisfies ReadonlyArray<{
  key: 'about' | 'dashboard' | 'itineraries' | 'aiDrafts' | 'profile' | 'settings'
  icon: LucideIcon
  to?: string
}>

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation('common')
  const location = useLocation()
  const [isMenuHidden, setIsMenuHidden] = useState<boolean>(isMenuInitiallyHidden)

  function hideMenu(): void {
    setIsMenuHidden(true)
    persistMenuHiddenState(true)
  }

  function showMenu(): void {
    setIsMenuHidden(false)
    persistMenuHiddenState(false)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.contentFrame} data-menu-hidden={isMenuHidden ? 'true' : 'false'}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
          <button
            type="button"
            className={styles.menuToggleButton}
            onClick={hideMenu}
            aria-label={t('navigation.hideMenu')}
            title={t('navigation.hideMenu')}
          >
            <span className={styles.menuIconDesktop} aria-hidden="true">
              <ChevronsLeft aria-hidden="true" />
            </span>
            <span className={styles.menuIconMobile} aria-hidden="true">
              <ChevronsUp aria-hidden="true" />
            </span>
          </button>

          <ul className={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon
              const label = t(`navigation.${item.key}`)

              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)

              return (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    className={styles.navItem}
                    data-active={isActive ? 'true' : 'false'}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </aside>

        <button
          type="button"
          className={styles.menuRevealButton}
          data-visible={isMenuHidden ? 'true' : 'false'}
          onClick={showMenu}
          aria-label={t('navigation.showMenu')}
          title={t('navigation.showMenu')}
        >
          <span className={styles.menuIconDesktop} aria-hidden="true">
            <ChevronsRight aria-hidden="true" />
          </span>
          <span className={styles.menuIconMobile} aria-hidden="true">
            <ChevronsDown aria-hidden="true" />
          </span>
        </button>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  )
}
