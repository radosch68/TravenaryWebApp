# Travenary Frontend

React + TypeScript + Vite SPA for authentication, profile management, and itinerary dashboard flows.

## Run locally
From repository root:

1. Install dependencies:
   - `npm --prefix frontend install`
2. Start dev server:
   - `npm --prefix frontend run dev`

## Environment
Configure API URL with:

- `VITE_API_BASE_URL` (example: `http://localhost:3000`)

If not set, frontend defaults to same host on port `3000`.

## Implemented flows
- Sign-up/sign-in/sign-out and token refresh handling.
- Dashboard list at `/` with deterministic sorting from backend:
  - `sortBy=plannedStartDate`
  - `sortOrder=asc`
- One-click template-backed create action (`POST /itineraries` with empty payload).
- Detail route at `/itineraries/:itineraryId`.
- Delete itinerary from detail with confirmation and dashboard return.

## Scripts
- `npm run dev` start Vite dev server.
- `npm run build` produce production bundle.
- `npm run lint` run TypeScript + ESLint checks.

## i18n and responsive rules
- User-facing strings must be externalized in locale files.
- Dashboard and detail pages should remain usable on phone and desktop widths.
