import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
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
//  - profileVisibility ('private' | 'public') — gates whether other people
//    can send this user a friend request at all. It has no bearing on
//    viewing once a friend request is accepted — see useFriends for that.
//  - profileCode ("friend code") — one stable code that identifies this
//    user, entered by someone else to send them a friend request. Generated
//    once, unconditionally, regardless of visibility — a Private user still
//    needs a code to hand out for when they flip back to Public later.
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

  // visibility: 'private' | 'public'
  async function setVisibility(visibility) {
    await setDoc(doc(db, 'users', userId), { profileVisibility: visibility }, { merge: true })
  }

  return { profile, setVisibility }
}
