import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { CollisionGuardRoute } from '@/app/guards/CollisionGuardRoute'
import { ProtectedRoute } from '@/app/guards/ProtectedRoute'
import { PublicOnlyRoute } from '@/app/guards/PublicOnlyRoute'
import { TopBanner } from '@/components/layout/TopBanner'
import { DashboardHomePage } from '@/pages/DashboardHomePage'
import { DashboardShellPage } from '@/pages/DashboardShellPage'
import { GithubOAuthCallbackPage } from '@/pages/GithubOAuthCallbackPage'
import { LinkProviderPage } from '@/pages/LinkProviderPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SignInPage } from '@/pages/SignInPage'
import { SignUpPage } from '@/pages/SignUpPage'
import { useAuthStore } from '@/store/auth-store'

export default function App(): ReactElement {
  const restoreSessionFromStorage = useAuthStore(
    (state) => state.restoreSessionFromStorage,
  )

  useEffect(() => {
    void restoreSessionFromStorage()
  }, [restoreSessionFromStorage])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TopBanner />
      <Routes>
        <Route
          path="/signin"
          element={
            <PublicOnlyRoute>
              <SignInPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignUpPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/link-provider"
          element={
            <PublicOnlyRoute>
              <CollisionGuardRoute>
                <LinkProviderPage />
              </CollisionGuardRoute>
            </PublicOnlyRoute>
          }
        />
        <Route path="/oauth/github/callback" element={<GithubOAuthCallbackPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itineraries"
          element={
            <ProtectedRoute>
              <DashboardShellPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
