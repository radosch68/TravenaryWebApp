import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { CollisionGuardRoute } from '@/app/guards/CollisionGuardRoute'
import { ProtectedRoute } from '@/app/guards/ProtectedRoute'
import { PublicOnlyRoute } from '@/app/guards/PublicOnlyRoute'
import { TopBanner } from '@/components/layout/TopBanner'
import { AiDraftDetailPage } from '@/pages/AiDraftDetailPage'
import { AiDraftsListPage } from '@/pages/AiDraftsListPage'
import { AiGenerationStartPage } from '@/pages/AiGenerationStartPage'
import { DashboardHomePage } from '@/pages/DashboardHomePage'
import { DashboardShellPage } from '@/pages/DashboardShellPage'
import { GithubOAuthCallbackPage } from '@/pages/GithubOAuthCallbackPage'
import { ItineraryEditPagePlaceholder } from '@/pages/ItineraryEditPagePlaceholder'
import { ItineraryMapPage } from '@/pages/ItineraryMapPage'
import { ItineraryViewPage } from '@/pages/ItineraryViewPage'
import { LinkProviderPage } from '@/pages/LinkProviderPage'
import { ManualItineraryStartPage } from '@/pages/ManualItineraryStartPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SharedItineraryMapPage } from '@/pages/SharedItineraryMapPage'
import { SharedItineraryViewPage } from '@/pages/SharedItineraryViewPage'
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
        <Route path="/s/:shareToken" element={<SharedItineraryViewPage />} />
        <Route path="/s/:shareToken/map" element={<SharedItineraryMapPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-drafts"
          element={
            <ProtectedRoute>
              <AiDraftsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-drafts/new"
          element={
            <ProtectedRoute>
              <AiGenerationStartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-drafts/:requestId"
          element={
            <ProtectedRoute>
              <AiDraftDetailPage />
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
          path="/itineraries/new/manual"
          element={
            <ProtectedRoute>
              <ManualItineraryStartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itineraries/:itineraryId"
          element={
            <ProtectedRoute>
              <ItineraryViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itineraries/:itineraryId/map"
          element={
            <ProtectedRoute>
              <ItineraryMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itineraries/:itineraryId/edit"
          element={
            <ProtectedRoute>
              <ItineraryEditPagePlaceholder />
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
