// metro.config.cjs — FINDING-06: Metro eagerly bundles every dynamic-import branch in
// src/lib/backend/index.ts (supabase | firebase | local). Provider SDKs and a couple of
// React Native deps are installed on demand, so a single-provider bundle would otherwise
// fail to resolve the branches it does not use (e.g. "Unable to resolve @supabase/supabase-js"
// in a FIREBASE/LOCAL project, or "firebase/auth" in a SUPABASE project).
//
// Fix (mirrors web's vite.config.ts): stub every optional module the ACTIVE provider does
// NOT use at runtime, decided from the generated provider contract. The stubs throw if
// ever called, so they only resolve never-executed code; the active provider keeps its
// real modules (which you install). Runtime reads the same versioned artifact.
//
// Each stubbed module is used EXCLUSIVELY inside a backend provider branch:
//   - @supabase/supabase-js            -> supabase branch only
//   - firebase/app|auth|firestore      -> firebase branch only
//   - expo-secure-store                -> supabase session storage only
//   - @react-native-async-storage/...  -> local + firebase branches only
// so stubbing it for a provider that does not run that branch never affects live code.
// (expo-linking is NOT stubbed: it is a base dependency used app-wide by App.tsx for
// auth deep-link handling, so the real module must resolve in every provider, LOCAL too.)
//
// This file is .cjs on purpose: package.json has "type": "module", so a .js Metro config
// would be loaded as ESM (Expo's metro-config is CommonJS). The .cjs extension keeps it
// CommonJS regardless.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

const provider = require('./src/config/provider.generated.json').backendProvider
const stub = (rel) => path.resolve(__dirname, rel)

const SUPABASE_STUB = stub('src/lib/backend/supabase/supabase-sdk-stub.ts')
const FIREBASE_STUB = stub('src/lib/backend/firebase/firebase-sdk-stub.ts')
const SECURE_STORE_STUB = stub('src/lib/backend/supabase/secure-store-stub.ts')
const ASYNC_STORAGE_STUB = stub('src/lib/backend/local/async-storage-stub.ts')

const stubs = {}
if (provider !== 'SUPABASE') {
  stubs['@supabase/supabase-js'] = SUPABASE_STUB
}
if (provider !== 'FIREBASE') {
  stubs['firebase/app'] = FIREBASE_STUB
  stubs['firebase/auth'] = FIREBASE_STUB
  stubs['firebase/firestore'] = FIREBASE_STUB
}
if (provider !== 'SUPABASE') {
  stubs['expo-secure-store'] = SECURE_STORE_STUB
}
// AsyncStorage is used by the Local and Firebase backends; only a SUPABASE project never
// touches it at runtime, so stub it only then.
if (provider === 'SUPABASE') {
  stubs['@react-native-async-storage/async-storage'] = ASYNC_STORAGE_STUB
}

const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stubPath = stubs[moduleName]
  if (stubPath) {
    return { type: 'sourceFile', filePath: stubPath }
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
