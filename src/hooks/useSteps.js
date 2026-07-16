import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Daily step counts, manually logged (browsers can't read the phone's
// pedometer). One doc per day, keyed by the ISO date, so re-logging a day
// simply overwrites it.
export function useSteps(userId) {
  const [steps, setSteps] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'steps')
    const unsub = onSnapshot(colRef, snapshot => {
      setSteps(snapshot.docs.map(d => ({ ...d.data(), date: d.id })))
    }, err => console.error('Steps error:', err))
    return unsub
  }, [userId])

  async function logSteps(date, count) {
    if (!count) {
      await deleteDoc(doc(db, 'users', userId, 'steps', date))
    } else {
      await setDoc(doc(db, 'users', userId, 'steps', date), { date, count })
    }
  }

  return { steps, logSteps }
}
