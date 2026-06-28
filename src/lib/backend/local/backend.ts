import type { Backend } from '../types'
import { createLocalBackend } from './backend.shared.js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// AsyncStorage adapter matching the synchronous Storage interface expected by backend.shared.js
const asyncStorageAdapter = {
    _cache: {} as Record<string, string | null>,
    getItem(key: string): string | null {
        return this._cache[key] ?? null
    },
    setItem(key: string, value: string): void {
        this._cache[key] = value
        AsyncStorage.setItem(key, value).catch(() => {})
    },
}

// Pre-load keys from AsyncStorage at import time
async function preloadStorage() {
    const keys = [
        'discipline_local_user',
        'discipline_local_space',
        'discipline_local_notifications',
    ]
    const pairs = await AsyncStorage.multiGet(keys)
    for (const [key, value] of pairs) {
        if (value !== null) {
            asyncStorageAdapter._cache[key] = value
        }
    }
}

// Initialize cache on module load
const _preloadPromise = preloadStorage()

function randomUUID(): string {
    // Simple UUID v4 fallback for React Native
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export const backend = createLocalBackend({
    storage: asyncStorageAdapter,
    randomUUID,
    now: () => new Date().toISOString(),
}) as Backend

export { _preloadPromise }
