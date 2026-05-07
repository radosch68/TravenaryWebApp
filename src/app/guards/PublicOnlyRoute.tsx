import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/store/auth-store'

type PublicOnlyRouteProps = {
  children: ReactNode
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps): ReactNode {
  const { t } = useTranslation(['common'])
  const accessToken = useAuthStore((state) => state.accessToken)
  const restorationChecked = useAuthStore((state) => state.restorationChecked)

  if (!restorationChecked) {
    return <p role="status" aria-live="polite">{t('common:loading')}</p>
  }

  if (accessToken) {
    return <Navigate replace to="/" />
  }

  return children
}
