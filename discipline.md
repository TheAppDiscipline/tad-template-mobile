<!--
  This is the project constitution. It will be populated by /discipline-step1
  with your app's contracts, switches, data model and Definition of Done.
  Do NOT rename the H2 anchor headings (## 0) Profile, ## 1) Non-Negotiables,
  etc.); the discipline:patch scripts depend on the exact heading text.
-->

# discipline.md — Project Constitution

## 0) Profile
- PROJECT_NAME:
- PRIMARY_GOAL:
- NORTH_STAR_METRIC:
- PROFILE:
- BACKEND_PROVIDER:
- AUTH_MODE:
- COLLAB_MODE:
- STACK:
  - Frontend: Mobile (Expo + React Native)
  - Hosting:
  - Backend:
- SYNC_MODE:
- PUSH_PLUGIN:
- AI_FEATURES:
- LANE: MOBILE
- STEP4_EXPANSION_MODE: batch
- READY_PROMOTION: per_packet
- DOCTRINE_VERSION: 1.0

### Env Configuration
- EXPO_PUBLIC_BACKEND_PROVIDER: Provider selection.
- EXPO_PUBLIC_AUTH_MODE: Authentication strategy.

#### Supabase Env
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
Rule: ANON_KEY only in frontend. Service role key never in frontend.

#### Firebase Env
- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_APP_ID
Rule: Mobile Firebase supports EMAIL_PASSWORD/NONE in this template. Magic link requires a verified HTTPS callback and must use Supabase unless you add and verify that infrastructure.

## 1) Non-Negotiables
- (inherited from Discipline Loop)

## 2) Tenancy & Permissions
- N/A

## 3) Data Model
- N/A

## 4) API / IO Shapes
- N/A

## 5) Sync Rules
- N/A

## 6) UI State Model
- N/A

## 7) Event / Notifications Model
- PUSH_PLUGIN=false

## 8) Design Tokens Contract
- N/A

## 9) Testing / Gates Contract
- N/A

## 10) LLM Contracts
- AI_FEATURES=none

## 11) Universal Definition of Done
- N/A
