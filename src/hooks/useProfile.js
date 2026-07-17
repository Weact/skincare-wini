import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'

// Excludes 0/O, 1/I/L — easy to mix up when someone's reading the code out
// loud or typing it back in from memory
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LENGTH = 7

function generateCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

// The current user's own sharing profile — a `users/{uid}` root doc (as
// opposed to its subcollections), holding their visibility mode
// ('private' | 'public' | 'whitelist'), the code that resolves to them
// (needed for both public and whitelist — someone still has to look you up
// by code either way), and, in whitelist mode, the list of viewer uids
// allowed to read it.
export function useProfile(userId) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      setProfile(snap.exists() ? snap.data() : {})
    }, err => console.error('Profile error:', err))
    return unsub
  }, [userId])

  // Collisions are astronomically unlikely at 31^7 combinations, but a
  // stale/duplicate code would fail the Firestore `create` rule outright
  // (no `allow update` exists for profileCodes), so just retry on either.
  async function claimNewCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const codeRef = doc(db, 'profileCodes', code)
      const existing = await getDoc(codeRef)
      if (existing.exists()) continue
      try {
        await setDoc(codeRef, { uid: userId })
        return code
      } catch {
        // Lost a race to someone else claiming the same code — try again
      }
    }
    throw new Error('Could not generate a unique profile code')
  }

  // visibility: 'private' | 'public' | 'whitelist'
  async function setVisibility(visibility) {
    const code = visibility !== 'private' && !profile?.profileCode
      ? await claimNewCode()
      : profile?.profileCode
    await setDoc(doc(db, 'users', userId), {
      profileVisibility: visibility,
      ...(code ? { profileCode: code } : {}),
    }, { merge: true })
  }

  async function addAllowedViewer(viewerUid) {
    const id = viewerUid.trim()
    if (!id) return
    await setDoc(doc(db, 'users', userId), { allowedViewerUids: arrayUnion(id) }, { merge: true })
  }

  async function removeAllowedViewer(viewerUid) {
    await setDoc(doc(db, 'users', userId), { allowedViewerUids: arrayRemove(viewerUid) }, { merge: true })
  }

  return { profile, setVisibility, addAllowedViewer, removeAllowedViewer }
}
