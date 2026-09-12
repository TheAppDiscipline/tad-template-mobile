import type { Backend } from '../types'
import { auth, db } from './client'
import {
    createUserWithEmailAndPassword,
    isSignInWithEmailLink,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    signOut as fbSignOut,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { createFirebaseBackend } from './backend.shared.js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'

export const backend = createFirebaseBackend({
    authClient: auth,
    db,
    firestore: { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where },
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    isSignInWithEmailLink,
    signOut: fbSignOut,
    getCurrentUrl: () => Linking.getInitialURL(),
    getPendingEmail: () => AsyncStorage.getItem('firebase_emailForSignIn'),
    clearPendingEmail: () => AsyncStorage.removeItem('firebase_emailForSignIn'),
}) as Backend

export async function handleFirebaseAuthUrl(url: string | null) {
    if (!url || !isSignInWithEmailLink(auth, url)) return

    const email = await AsyncStorage.getItem('firebase_emailForSignIn')
    if (!email) {
        return
    }

    await signInWithEmailLink(auth, email, url)
    await AsyncStorage.removeItem('firebase_emailForSignIn')
}
