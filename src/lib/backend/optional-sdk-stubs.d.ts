/* eslint-disable @typescript-eslint/no-explicit-any */
// Stub type declarations for optional backend SDKs.
// These allow TypeScript to compile when the real SDKs are not installed.
// Once you install the real SDK (e.g. `npm install @supabase/supabase-js`),
// the real types from node_modules take precedence over these stubs.

declare module '@supabase/supabase-js' {
    export function createClient(url: string, key: string, options?: any): any
}

declare module 'firebase/app' {
    export function getApps(): any[]
    export function initializeApp(config: Record<string, any>): any
}

declare module 'firebase/auth' {
    export function getAuth(app: any): any
    export function initializeAuth(app: any, options?: any): any
    export function getReactNativePersistence(storage: any): any
    export function isSignInWithEmailLink(auth: any, url: string): boolean
    export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>
    export function sendSignInLinkToEmail(auth: any, email: string, actionCodeSettings: any): Promise<void>
    export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>
    export function signInWithEmailLink(auth: any, email: string, url: string): Promise<void>
    export function signOut(auth: any): Promise<void>
}

declare module 'firebase/firestore' {
    export function collection(db: any, path: string): any
    export function doc(db: any, path: string, id?: string): any
    export function getDoc(ref: any): Promise<any>
    export function getDocs(query: any): Promise<any>
    export function getFirestore(app: any): any
    export function limit(count: number): any
    export function orderBy(field: string, direction?: 'asc' | 'desc'): any
    export function query(source: any, ...constraints: any[]): any
    export function setDoc(ref: any, data: any, options?: any): Promise<void>
    export function updateDoc(ref: any, data: any): Promise<void>
    export function where(field: string, op: string, value: any): any
}

declare module '@react-native-async-storage/async-storage' {
    const AsyncStorage: {
        getItem(key: string): Promise<string | null>
        setItem(key: string, value: string): Promise<void>
        removeItem(key: string): Promise<void>
        multiGet(keys: string[]): Promise<[string, string | null][]>
        clear(): Promise<void>
    }
    export default AsyncStorage
}

declare module 'expo-linking' {
    export function createURL(path: string, params?: any): string
    export function getInitialURL(): Promise<string | null>
    export function addEventListener(type: 'url', handler: (event: { url: string }) => void): { remove(): void }
}

declare module 'expo-secure-store' {
    export function getItemAsync(key: string): Promise<string | null>
    export function setItemAsync(key: string, value: string): Promise<void>
    export function deleteItemAsync(key: string): Promise<void>
}
