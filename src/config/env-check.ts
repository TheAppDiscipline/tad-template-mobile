/**
 * Discipline Loop env-check — fail-fast on misconfigured env vars.
 *
 * Import this module once at app startup (App.tsx).
 * It throws immediately if required vars are missing or have invalid values,
 * so misconfiguration surfaces as a clear error rather than a silent fallback.
 */

import { resolveRuntimeConfig } from './runtime.shared.js'

const env = process.env

// --- Valid values ---
const VALID_PROVIDERS = ['SUPABASE', 'FIREBASE', 'LOCAL_ONLY']
const VALID_AUTH_MODES = ['MAGIC_LINK', 'EMAIL_PASSWORD', 'BOTH', 'NONE']

// Validate the EFFECTIVE config (what the app will actually run), not the raw env
// vars. Reading the raw values meant an unset EXPO_PUBLIC_BACKEND_PROVIDER skipped
// every provider-specific check while the runtime still resolved a default, so a
// project with no .env passed env-check and then ran against a backend whose
// required vars were never verified. One resolver, one answer.
const resolved = resolveRuntimeConfig(env)
const provider = resolved.BACKEND_PROVIDER
const authMode = resolved.AUTH_MODE

// The raw values still matter for typo reporting: resolveRuntimeConfig silently
// falls back to the default on an invalid value, and a typo must not look like a
// deliberate default.
const rawProvider = (env.EXPO_PUBLIC_BACKEND_PROVIDER as string | undefined)?.trim().toUpperCase()
const rawAuthMode = (env.EXPO_PUBLIC_AUTH_MODE as string | undefined)?.trim().toUpperCase()

const errors: string[] = []

// --- Provider must be valid if set ---
if (rawProvider && !VALID_PROVIDERS.includes(rawProvider)) {
    errors.push(
        `EXPO_PUBLIC_BACKEND_PROVIDER="${env.EXPO_PUBLIC_BACKEND_PROVIDER}" is not valid. ` +
        `Allowed: ${VALID_PROVIDERS.join(' | ')}`
    )
}

// --- Auth mode must be valid if set ---
if (rawAuthMode && !VALID_AUTH_MODES.includes(rawAuthMode)) {
    errors.push(
        `EXPO_PUBLIC_AUTH_MODE="${env.EXPO_PUBLIC_AUTH_MODE}" is not valid. ` +
        `Allowed: ${VALID_AUTH_MODES.join(' | ')}`
    )
}

if (provider === 'FIREBASE' && (authMode === 'MAGIC_LINK' || authMode === 'BOTH')) {
    errors.push(
        'Firebase Mobile magic link requires a verified HTTPS callback; use EMAIL_PASSWORD or Supabase for magic link.'
    )
}

// --- Provider-specific required vars ---
if (provider === 'SUPABASE') {
    if (!env.EXPO_PUBLIC_SUPABASE_URL) errors.push('EXPO_PUBLIC_SUPABASE_URL is required when EXPO_PUBLIC_BACKEND_PROVIDER=SUPABASE')
    if (!env.EXPO_PUBLIC_SUPABASE_ANON_KEY) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is required when EXPO_PUBLIC_BACKEND_PROVIDER=SUPABASE')
}

if (provider === 'FIREBASE') {
    const required = [
        'EXPO_PUBLIC_FIREBASE_API_KEY',
        'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
        'EXPO_PUBLIC_FIREBASE_APP_ID',
    ] as const
    for (const key of required) {
        if (!env[key]) errors.push(`${key} is required when EXPO_PUBLIC_BACKEND_PROVIDER=FIREBASE`)
    }
}

// --- Fail fast ---
if (errors.length > 0) {
    const message = [
        '[Discipline Loop] env-check failed — fix before continuing:',
        ...errors.map(e => `  - ${e}`),
    ].join('\n')
    throw new Error(message)
}
