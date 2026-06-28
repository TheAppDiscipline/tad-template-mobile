// Build-time stub for @react-native-async-storage/async-storage when the active provider
// does NOT use it (FINDING-06). Aliased in metro.config.cjs only when
// EXPO_PUBLIC_BACKEND_PROVIDER is SUPABASE — the Local and Firebase backends DO use
// AsyncStorage, so for those it stays the real dependency (install it).
//
// Metro bundles the Local/Firebase branches even in a Supabase project; their AsyncStorage
// import is stubbed here so the bundle resolves the never-executed code.
//
// If your active backend uses AsyncStorage (LOCAL_ONLY or FIREBASE):
// `npm i @react-native-async-storage/async-storage`.

const notInstalled = (): never => {
    throw new Error(
        'AsyncStorage is not installed (the active EXPO_PUBLIC_BACKEND_PROVIDER does not use it).'
    )
}

const AsyncStorage = {
    getItem: notInstalled,
    setItem: notInstalled,
    removeItem: notInstalled,
    multiGet: notInstalled,
    clear: notInstalled,
}

export default AsyncStorage
