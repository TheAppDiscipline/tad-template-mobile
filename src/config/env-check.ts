/**
 * Discipline Loop env-check — fail-fast on credentials and legacy architecture vars.
 *
 * Import this module once at app startup (App.tsx). Provider and auth come from
 * the generated, versioned contract; .env contains credentials only.
 */

import { resolveRuntimeConfig } from './runtime.shared.js'

const env = process.env
const resolved = resolveRuntimeConfig()
const provider = resolved.BACKEND_PROVIDER
const authMode = resolved.AUTH_MODE
const errors: string[] = []

const LEGACY_PROVIDER_KEY = 'EXPO_PUBLIC_BACKEND_PROVIDER'
const LEGACY_AUTH_KEY = 'EXPO_PUBLIC_AUTH_MODE'
for (const key of [LEGACY_PROVIDER_KEY, LEGACY_AUTH_KEY]) {
    if (env[key]) {
        errors.push(
            `${key} no longer selects architecture. Set BACKEND_PROVIDER and AUTH_MODE in discipline.md, then run npm run discipline:provider:generate.`,
        )
    }
}

if (provider === 'FIREBASE' && (authMode === 'MAGIC_LINK' || authMode === 'BOTH')) {
    errors.push(
        'Firebase Mobile magic link requires a verified HTTPS callback; use EMAIL_PASSWORD or Supabase for magic link.',
    )
}

if (provider === 'SUPABASE') {
    if (!env.EXPO_PUBLIC_SUPABASE_URL) errors.push('EXPO_PUBLIC_SUPABASE_URL is required when discipline.md selects SUPABASE')
    if (!env.EXPO_PUBLIC_SUPABASE_ANON_KEY) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is required when discipline.md selects SUPABASE')
}

if (provider === 'FIREBASE') {
    const required = [
        'EXPO_PUBLIC_FIREBASE_API_KEY',
        'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
        'EXPO_PUBLIC_FIREBASE_APP_ID',
    ] as const
    for (const key of required) {
        if (!env[key]) errors.push(`${key} is required when discipline.md selects FIREBASE`)
    }
}

if (errors.length > 0) {
    throw new Error([
        '[Discipline Loop] env-check failed — fix before continuing:',
        ...errors.map(e => `  - ${e}`),
    ].join('\n'))
}
