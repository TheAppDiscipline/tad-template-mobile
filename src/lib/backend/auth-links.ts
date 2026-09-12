import { BACKEND_PROVIDER } from '../../config/runtime'

export async function handleIncomingAuthUrl(url: string | null) {
    if (!url) return

    switch (BACKEND_PROVIDER) {
        case 'SUPABASE': {
            const mod = await import('./supabase/deep-link')
            const result = await mod.handleSupabaseAuthUrl(url)
            if (result?.error) console.warn('Supabase auth callback failed:', result.error)
            return
        }
        case 'FIREBASE': {
            const mod = await import('./firebase/backend')
            await mod.handleFirebaseAuthUrl(url)
            return
        }
        default:
            return
    }
}
