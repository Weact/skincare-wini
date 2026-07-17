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
//  - profileCode — resolves to this user, for someone else to view them
//    (needed for both public and whitelist — someone still looks you up by
//    code either way)
//  - viewerCode — a second, separate code that also resolves to this user,
//    but used the other direction: hand it to someone else so *they* can
//    add *you* to *their* whitelist, without ever exposing your raw
//    Firebase uid
//  - allowedViewerUids — real uids, resolved from viewer codes at the point
//    they're added (the Firestore rule checks request.auth.uid against this
//    array directly, so it has to hold actual uids, not codes)
export function useProfile(userId, isAnonymous) {
  const [profile, setProfile] = useState(null)
  const viewerCodeClaimStarted = useRef(false)

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      setProfile(snap.exists() ? snap.data() : {})
    }, err => console.error('Profile error:', err))
    return unsub
  }, [userId])

  // Collisions are astronomically unlikely at 31^7 combinations, but a
  // stale/duplicate code would fail the Firestore `create` rule outright
  // (no `allow update` exists for either code collection), so just retry.
  async function claimNewCode(collectionName) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const codeRef = doc(db, collectionName, code)
      const existing = await getDoc(codeRef)
      if (existing.exists()) continue
      try {
        await setDoc(codeRef, { uid: userId })
        return code
      } catch {
        // Lost a race to someone else claiming the same code — try again
      }
    }
    throw new Error(`Could not generate a unique ${collectionName} code`)
  }

  // visibility: 'private' | 'public' | 'whitelist'
  async function setVisibility(visibility) {
    const code = visibility !== 'private' && !profile?.profileCode
      ? await claimNewCode('profileCodes')
      : profile?.profileCode
    await setDoc(doc(db, 'users', userId), {
      profileVisibility: visibility,
      ...(code ? { profileCode: code } : {}),
    }, { merge: true })
  }

  // Every non-anonymous user gets a stable viewer code lazily, the first
  // time their profile loads without one — independent of their own
  // visibility setting, since it identifies *them* to someone else's
  // whitelist rather than controlling who can see their own data. Guarded
  // with a ref (not just the profile.viewerCode check) so a burst of
  // snapshot updates before the write round-trips can't claim two codes.
  useEffect(() => {
    if (!userId || isAnonymous || !profile || profile.viewerCode) return
    if (viewerCodeClaimStarted.current) return
    viewerCodeClaimStarted.current = true
    claimNewCode('viewerCodes').then(code => {
      setDoc(doc(db, 'users', userId), { viewerCode: code }, { merge: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAnonymous, profile])

  // Resolves the other person's viewer code to their uid before storing it —
  // the whitelist array itself must hold real uids for the security rule's
  // `request.auth.uid in allowedViewerUids` check to work.
  async function addAllowedViewer(viewerCode) {
    const code = viewerCode.trim().toUpperCase()
    if (!code) return
    const codeSnap = await getDoc(doc(db, 'viewerCodes', code))
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
