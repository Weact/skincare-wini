import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInAnonymously,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still initializing

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        setUser(firebaseUser)
      } else {
        try {
          await signInAnonymously(auth)
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
          setUser(null)
        }
      }
    })
    return unsub
  }, [])

  async function linkWithGoogle() {
    if (!auth.currentUser) return
    const provider = new GoogleAuthProvider()
    try {
      await linkWithPopup(auth.currentUser, provider)
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return
      if (err.code === 'auth/credential-already-in-use') {
        // Google account already exists — sign in with it directly
        const credential = GoogleAuthProvider.credentialFromError(err)
        if (credential) await signInWithCredential(auth, credential)
      } else {
        console.error('Google link error:', err)
      }
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    // onAuthStateChanged will fire and automatically create a new anonymous session
  }

  return { user, linkWithGoogle, handleSignOut }
}
