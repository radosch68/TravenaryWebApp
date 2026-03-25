import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/store/auth-store'

interface CollisionGuardRouteProps {
  children: ReactNode
}

export function CollisionGuardRoute({ children }: CollisionGuardRouteProps): ReactNode {
  const collision = useAuthStore((state) => state.identityCollision)

  if (!collision || collision.linkStatus !== 'collision_blocked') {
    return <Navigate replace to="/signin" state={{ oneTimeMessageKey: 'auth:errors.restartSocialSignIn' }} />
  }

  return children
}
