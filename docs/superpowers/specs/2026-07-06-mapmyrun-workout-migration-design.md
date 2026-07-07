# MapMyRun-Only Workout Sync Design

## Summary

This project deprecates Strava as the workout data source for `distilledchild.space/interests/workout` and transitions the app to a MapMyRun-only ingestion flow while preserving the existing user-facing workout display pattern.

The current product behavior already uses a two-step architecture:
1. sync workout data from a provider into MongoDB
2. render the workout page from MongoDB rather than live provider API calls

That architecture will remain unchanged. The change is the upstream provider: Strava will be deprecated and MapMyRun will become the only supported sync source once credentials are issued.

## Goals

- Keep the workout page display behavior substantially unchanged.
- Continue serving the workout page from MongoDB via `GET /api/workouts`.
- Replace Strava as the sync provider with MapMyRun.
- Prepare the codebase so that once MapMyRun credentials arrive, only credential insertion and provider sync implementation remain.
- Remove Strava from the user-facing UI immediately.
- Make the workout storage schema provider-neutral so future provider swaps do not require another schema redesign.

## Non-Goals

- Full MapMyRun sync implementation before the API credentials are issued.
- Deleting historical Strava-backed workout rows immediately.
- Rebuilding the workout UI or changing the visual presentation in a major way.
- Showing live provider data directly in the UI without database persistence.

## Current State

### Frontend

The workout page currently:
- initiates Strava OAuth from the workout tab
- loads workouts from `GET /api/workouts`
- renders a single activity list and monthly aggregations
- stores fallback Strava-specific localStorage keys

The page naming and state are Strava-specific even though rendering is already DB-backed.

### Backend

The backend currently:
- exposes Strava OAuth endpoints
- exposes Strava sync endpoints
- persists workouts into `INTERESTS_WORKOUT`
- serves all workouts through `GET /api/workouts`

The schema is Strava-specific because `activity_id` is the unique key and provider identity is not modeled explicitly.

## Selected Approach

### Chosen approach: staged provider replacement

We will use a staged replacement strategy.

In stage 1, before MapMyRun credentials are available:
- remove Strava from the user-facing workout flow
- rename frontend/backend concepts from Strava-specific to generic workout/provider-neutral naming where safe
- prepare a provider-neutral workout schema
- preserve DB-backed rendering
- keep deprecated Strava backend code temporarily so the repo stays stable until MapMyRun sync is finished and verified

In stage 2, after MapMyRun credentials are available:
- insert real `MAPMYRUN_CLIENT_ID` and `MAPMYRUN_CLIENT_SECRET`
- complete the MapMyRun sync route
- upsert MapMyRun workouts into MongoDB
- expose only the MapMyRun auth/sync path in the UI
- remove deprecated Strava code once MapMyRun sync is verified end-to-end

### Why this approach

This approach minimizes user-facing disruption and lets us continue working before credentials arrive. It also avoids a risky all-at-once cutover where the existing workout feature would be renamed and rewired without the ability to test the final provider integration.

## Target Architecture

### High-level flow

1. User opens the workout page.
2. Frontend fetches workouts from `GET /api/workouts`.
3. Backend reads normalized workout documents from MongoDB.
4. UI renders the same table, monthly metrics, and calendar from DB-backed workout rows.
5. When the user explicitly syncs workouts, the frontend starts MapMyRun OAuth.
6. MapMyRun redirects to `/mapmyrun/callback`.
7. Frontend callback page exchanges the code via backend API.
8. Backend fetches and normalizes MapMyRun workouts.
9. Backend upserts normalized workout rows into MongoDB.
10. Future page loads continue reading from DB only.

### Architectural principle

The app should treat provider sync as ingestion, not rendering.

That means provider APIs are used only for:
- authorization
- token exchange
- sync ingestion

The rendered experience remains database-first.

## Data Model Design

### Schema direction

The workout collection should become provider-neutral.

#### Required fields

- `source`: string
  - allowed values during transition: `strava`, `mapmyrun`
- `external_activity_id`: string
  - provider-native activity id normalized to string
- `source_athlete_id`: string or number
  - provider-native athlete/user id when available
- `name`: string
- `distance`: number
- `moving_time`: number
- `elapsed_time`: number
- `total_elevation_gain`: number
- `type`: string
- `sport_type`: string
- `start_date`: date
- `start_date_local`: date
- `average_speed`: number
- `max_speed`: number
- `insertedAt`: date
- `createdAt`: date
- optional future `updatedAt`: date

#### Transitional legacy field

- `activity_id`
  - retained temporarily for legacy compatibility during migration only
  - no longer the primary unique identifier once migration completes

### Unique identity

Replace the current single-field uniqueness assumption with a compound identity:
- unique index on `(source, external_activity_id)`

This prevents future provider collisions and decouples storage identity from one vendor.

### Historical Strava rows

Historical rows should be preserved.

Migration behavior:
- existing rows receive `source = 'strava'`
- existing rows receive `external_activity_id = String(activity_id)`
- existing rows remain readable through `GET /api/workouts`

This preserves history while allowing future MapMyRun rows to coexist cleanly.

## Frontend Design

### User-facing product behavior

The workout page should continue to display:
- activity list
- date
- activity name
- type icon/text
- distance
- time
- elevation
- average pace
- monthly distance chart
- monthly calendar marks

No major visual redesign is required.

### Frontend naming cleanup

The frontend should stop referring to workouts as Strava-specific.

Examples:
- `stravaActivities` -> `workoutActivities`
- `loadingStrava` -> `loadingWorkouts`
- `handleStravaAuth` -> `handleMapMyRunAuth` or `handleWorkoutSyncAuth`
- Strava-specific fallback localStorage names should be deprecated or renamed

### UI behavior before credentials arrive

Before real credentials are available, the workout page should not expose a broken live MapMyRun sync action.

Recommended behavior:
- remove or hide the existing Strava sync CTA from the user-facing workout page
- optionally leave a disabled internal placeholder only if it helps development, but do not present a broken provider action to end users

### Callback page

The app now includes a `MapMyRunCallback` route.

Expected final callback behavior:
- read the `code`
- exchange it through backend
- trigger workout sync once sync route exists
- redirect back to `/interests/workout`
- show clear error UI if token exchange or sync fails

## Backend Design

### APIs to preserve

- `GET /api/workouts`
  - remains the single read endpoint for the workout page

### APIs to complete for MapMyRun

- `GET /api/mapmyrun/auth`
  - return provider auth URL
- `POST /api/mapmyrun/exchange_token`
  - exchange auth code for token
- `POST /api/workouts/sync-mapmyrun` or `POST /api/workouts/sync`
  - fetch provider workouts
  - normalize rows
  - upsert into MongoDB

### Sync endpoint naming recommendation

Use a provider-explicit sync route:
- `POST /api/workouts/sync-mapmyrun`

Reason:
- keeps the transition clear
- avoids hidden behavior changes in the existing Strava sync endpoint
- makes cleanup easier once Strava code is removed

After migration completes, this could optionally be renamed back to a generic `POST /api/workouts/sync` if desired, but that is not required for the transition.

### Normalization layer

Introduce a normalization step between MapMyRun API responses and MongoDB writes.

The normalizer should output the provider-neutral workout shape regardless of upstream payload format.

This is important because MapMyRun field mapping differs from Strava, especially around:
- activity type representation
- elevation/ascent derivation
- route-linked data

## Migration Plan

### Pre-credential migration work

Before credentials arrive, implement:
- schema updates for provider-neutral storage
- migration script or startup-safe migration path for historical Strava rows
- frontend naming cleanup
- removal of user-facing Strava sync action
- MapMyRun callback flow wiring
- placeholder backend credential handling already prepared through GCP secrets

### Post-credential activation work

After credentials arrive:
- replace placeholder GCP secret values with real values
- complete sync endpoint implementation
- test MapMyRun OAuth end-to-end
- test DB upsert behavior
- verify page rendering from DB
- remove deprecated Strava code after verification

## Testing Strategy

### Before credentials

Tests should cover:
- schema migration behavior for legacy Strava rows
- `GET /api/workouts` returning migrated documents correctly
- frontend rendering from provider-neutral rows
- callback page behavior when token exchange succeeds or fails
- hidden or removed Strava CTA behavior

### After credentials

Tests should cover:
- auth URL generation
- token exchange happy path and failure path
- sync normalization from MapMyRun payloads to workout documents
- duplicate handling via `(source, external_activity_id)`
- historical Strava rows coexisting with MapMyRun rows
- workout page rendering from mixed historical data without UI regression

### Verification commands

At minimum, each implementation step should be backed by:
- targeted tests for any new transformation or migration logic
- full frontend production build
- backend syntax/runtime sanity check

## Risks and Mitigations

### Risk 1: schema migration breaks existing workout display

Mitigation:
- keep `GET /api/workouts` shape compatible during transition
- retain legacy compatibility fields temporarily
- verify rendering against historical rows before enabling new sync

### Risk 2: mixed historical Strava rows and future MapMyRun rows render inconsistently

Mitigation:
- normalize all rows to a common output shape before rendering
- migrate old rows before MapMyRun sync is activated

### Risk 3: user sees a broken sync button before credentials arrive

Mitigation:
- remove or hide the sync CTA until real credentials are available

### Risk 4: MapMyRun activity typing or elevation data differs from Strava assumptions

Mitigation:
- isolate provider normalization logic
- allow conservative fallbacks for missing elevation or unknown type values
- test representative sample payloads once credentials arrive

## Implementation Boundary for This Pre-Key Phase

This design intentionally limits pre-key implementation to work that can be completed and verified without live provider credentials.

Included now:
- schema preparation
- migration preparation
- frontend terminology cleanup
- UI deprecation of Strava
- MapMyRun callback wiring
- route and secret preparation

Deferred until credentials arrive:
- live provider sync implementation
- production OAuth verification
- payload-specific normalization refinements
- final Strava code deletion

## Acceptance Criteria

The pre-key phase is complete when:
- the workout page still renders from MongoDB
- the UI no longer presents Strava as the active provider
- the backend schema supports provider-neutral identity
- historical Strava rows remain readable
- the codebase is ready to accept real MapMyRun credentials with minimal follow-up work

The post-key phase is complete when:
- MapMyRun OAuth succeeds end-to-end
- MapMyRun sync stores normalized workouts in MongoDB
- the workout page shows synced workouts from DB
- deprecated Strava code has been removed after successful verification
