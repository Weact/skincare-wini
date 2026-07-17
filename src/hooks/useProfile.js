import { useState, useEffect, useRef } from 'react'
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
// opposed to its subcollections), holding:
//  - profileVisibility ('private' | 'public' | 'whitelist')
//  - profileCode — one stable code that identifies this user both ways:
//    someone enters it to view this profile (if Public, or if they're on
//    the Whitelist), and it's also what this user hands to someone else so
//    *that* person can add them to *their own* whitelist. Generated once,
//    unconditionally, regardless of this user's own visibility setting —
//    a Private user still needs a code to give out for other people's
//    whitelists even though nobody can view their own data with it.
//  - allowedViewerUids — real uids, resolved from profile codes at the
//    point they're added (the Firestore rule checks request.auth.uid
//    against this array directly, so it has to hold actual uids, not codes)
export function useProfile(userId, isAnonymous) {
  const [profile, setProfile] = useState(null)
  const codeClaimStarted = useRef(false)

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

  // Every non-anonymous user gets a stable code lazily, the first time their
  // profile loads without one — independent of their own visibility setting
  // (see the comment above). Guarded with a ref (not just the
  // profile.profileCode check) so a burst of snapshot updates before the
  // write round-trips can't claim two codes; reset on failure so a later
  // profile update gets a chance to retry instead of staying stuck.
  useEffect(() => {
    if (!userId || isAnonymous || !profile || profile.profileCode) return
    if (codeClaimStarted.current) return
    codeClaimStarted.current = true
    claimNewCode()
      .then(code => setDoc(doc(db, 'users', userId), { profileCode: code }, { merge: true }))
      .catch(err => {
        console.error('Profile code claim failed:', err)
        codeClaimStarted.current = false
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAnonymous, profile])

  // visibility: 'private' | 'public' | 'whitelist'
  async function setVisibility(visibility) {
    await setDoc(doc(db, 'users', userId), { profileVisibility: visibility }, { merge: true })
  }

  // Resolves the other person's code to their uid before storing it — the
  // whitelist array itself must hold real uids for the security rule's
  // `request.auth.uid in allowedViewerUids` check to work.
  async function addAllowedViewer(code) {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    const codeSnap = await getDoc(doc(db, 'profileCodes', trimmed))
    if (!codeSnap.exists()) throw new Error('not-found')
    await setDoc(doc(db, 'users', userId), {
      allowedViewerUids: arrayUnion(codeSnap.data().uid),
    }, { merge: true })
  }

  async function removeAllowedViewer(viewerUid) {
    await setDoc(doc(db, 'users', userId), { allowedViewerUids: arrayRemove(viewerUid) }, { merge: true })
  }

  return { profile, setVisibility, addAllowedViewer, removeAllowedViewer }
}
