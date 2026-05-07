import {
  LayoutDashboard,
  ListTodo,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import styles from './AppShell.module.css'

type AppShellProps = {
  children: ReactNode
}

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, to: '/' },
  { key: 'itineraries', icon: ListTodo, to: '/itineraries' },
  { key: 'profile', icon: UserRound, to: '/profile' },
  { key: 'settings', icon: Settings, to: '/settings' },
] as const satisfies ReadonlyArray<{
  key: 'dashboard' | 'itineraries' | 'profile' | 'settings'
  icon: LucideIcon
  to?: string
}>

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation('common')
  const location = useLocation()

  return (
    <div className={styles.shell}>
      <div className={styles.contentFrame}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
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

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  )
}
