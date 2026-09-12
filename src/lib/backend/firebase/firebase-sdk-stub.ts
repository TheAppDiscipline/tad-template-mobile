// Build-time stub for the Firebase SDK when Firebase is NOT the active provider
// (FINDING-06). Aliased from `firebase/app|auth|firestore` in metro.config.cjs only when
// the generated provider contract is not FIREBASE.
//
// Metro eagerly bundles every dynamic-import branch in src/lib/backend/index.ts. The
// Firebase branch only runs when the provider is FIREBASE; otherwise `firebase` is not
// installed, so the specifiers are stubbed here purely so the bundle can resolve the
// never-executed code.
//
// If you switch to FIREBASE: `npm i firebase`. metro.config.cjs then stops stubbing
// firebase/* automatically, so the real SDK is bundled.

const notInstalled = (): never => {
    throw new Error(
        'Firebase SDK is not installed (Firebase is not the active generated provider).'
    )
}

export const initializeApp = notInstalled
export const getAuth = notInstalled
export const getFirestore = notInstalled
export const sendSignInLinkToEmail = notInstalled
export const signOut = notInstalled
