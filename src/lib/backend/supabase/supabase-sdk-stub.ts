// Build-time stub for the Supabase SDK when Supabase is NOT the active provider
// (FINDING-06). Aliased from `@supabase/supabase-js` in metro.config.cjs only when
// EXPO_PUBLIC_BACKEND_PROVIDER is not SUPABASE.
//
// Metro eagerly bundles every dynamic-import branch in src/lib/backend/index.ts. The
// Supabase branch only runs when the provider is SUPABASE; otherwise @supabase/supabase-js
// is not installed, so the specifier is stubbed here purely so the bundle can resolve the
// never-executed code.
//
// If you use SUPABASE: `npm i @supabase/supabase-js`. metro.config.cjs then stops stubbing
// it automatically, so the real SDK is bundled.

const notInstalled = (): never => {
    throw new Error(
        'Supabase SDK is not installed (Supabase is not the active EXPO_PUBLIC_BACKEND_PROVIDER).'
    )
}

export const createClient = notInstalled
