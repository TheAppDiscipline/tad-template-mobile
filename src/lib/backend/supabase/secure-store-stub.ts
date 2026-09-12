function missing() {
  throw new Error('expo-secure-store is not installed (only the Supabase backend branch uses it).')
}

export const getItemAsync = missing
export const setItemAsync = missing
export const deleteItemAsync = missing
