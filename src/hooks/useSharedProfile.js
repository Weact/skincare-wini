import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Resolves a share code to its owner's uid. Rather than duplicating the
// public/whitelist logic client-side, this just tries to read the owner's
// profile doc: Firestore's rules (`ownerSharesWith`) are the actual
// enforcement, so a successful read already means we're allowed to see it —
// public, or our own uid is on their whitelist — and a denied/missing read
// means we're not, for whatever reason.
export function useSharedProfile(code) {
  const [state, setState] = useState({ loading: false, uid: null, error: null })

  useEffect(() => {
    if (!code) {
      setState({ loading: false, uid: null, error: null })
      return
    }
    let cancelled = false
    setState({ loading: true, uid: null, error: null })

    ;(async () => {
      try {
        const codeSnap = await getDoc(doc(db, 'profileCodes', code.trim().toUpperCase()))
        if (!codeSnap.exists()) {
          if (!cancelled) setState({ loading: false, uid: null, error: 'not-found' })
          return
        }
        const uid = codeSnap.data().uid
        await getDoc(doc(db, 'users', uid))
        if (!cancelled) setState({ loading: false, uid, error: null })
      } catch (err) {
        console.error('Shared profile lookup error:', err)
        if (!cancelled) setState({ loading: false, uid: null, error: 'private' })
      }
    })()

    return () => { cancelled = true }
  }, [code])

  return state
}
