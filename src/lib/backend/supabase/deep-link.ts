import { supabase } from './client'

export async function handleSupabaseAuthUrl(url: string | null) {
  if (!url) return { handled: false, reason: 'missing_url' }

  const parsed = new URL(url)
  const authError = parsed.searchParams.get('error') ?? parsed.searchParams.get('error_code')
  if (authError) {
    return {
      handled: true,
      error: authError,
      description: parsed.searchParams.get('error_description') ?? undefined,
    }
  }

  const code = parsed.searchParams.get('code')
  if (!code) return { handled: false, reason: 'missing_code' }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return { handled: true, error: error.message }

  return { handled: true }
}
