import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { CollisionGuardRoute } from './guards/CollisionGuardRoute'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { PublicOnlyRoute } from './guards/PublicOnlyRoute'
import { ItineraryDetailPage } from '@/pages/ItineraryDetailPage'
import { HomePage } from '../pages/HomePage'
import { GithubOAuthCallbackPage } from '../pages/GithubOAuthCallbackPage'
import { LinkProviderPage } from '../pages/LinkProviderPage'
import { ProfilePage } from '../pages/ProfilePage'
import { SignInPage } from '../pages/SignInPage'
import { SignUpPage } from '../pages/SignUpPage'
import { useAuthStore } from '../store/auth-store'

export default function App(): ReactElement {
  const restoreSessionFromStorage = useAuthStore(
    (state) => state.restoreSessionFromStorage,
  )

  useEffect(() => {
    void restoreSessionFromStorage()
  }, [restoreSessionFromStorage])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itineraries/:itineraryId"
          element={
            <ProtectedRoute>
              <ItineraryDetailPage />
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
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
