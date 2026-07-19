import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { todayISO } from '../utils/dateUtils'

// One doc per position, only created once the user has interacted with it —
// absence means "not scratched yet". Relies solely on the blanket
// users/{uid}/{document=**} owner-only rule in firestore.rules; there is no
// friend-read rule for this subcollection anywhere, by design.
export function usePositions(userId) {
  const [positionStates, setPositionStates] = useState({})

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(collection(db, 'users', userId, 'positions'), snapshot => {
      const next = {}
      snapshot.docs.forEach(d => { next[d.id] = d.data() })
      setPositionStates(next)
    }, err => console.error('Positions error:', err))
    return unsub
  }, [userId])

  async function revealPosition(id) {
    if (positionStates[id]?.scratched) return
    await setDoc(doc(db, 'users', userId, 'positions', id), {
      scratched: true, scratchedAt: todayISO(),
    }, { merge: true })
  }

  async function togglePositionDone(id) {
    const nowDone = !positionStates[id]?.done
    await setDoc(doc(db, 'users', userId, 'positions', id), {
      done: nowDone, doneAt: nowDone ? todayISO() : null,
    }, { merge: true })
  }

  // Deletes the given position docs rather than setting scratched:false —
  // absence already means "not scratched" (see the comment above), so this
  // just puts those cards back under their cover, at default/undone state.
  async function hidePositions(ids) {
    if (ids.length === 0) return
    const batch = writeBatch(db)
    ids.forEach(id => batch.delete(doc(db, 'users', userId, 'positions', id)))
    await batch.commit()
  }

  return { positionStates, revealPosition, togglePositionDone, hidePositions }
}
