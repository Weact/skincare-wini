import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Poop log — one doc per logged event (a day can have more than one), just
// a date + time. No edit flow, only add/delete.
export function usePoops(userId) {
  const [poops, setPoops] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'poops')
    const unsub = onSnapshot(colRef, snapshot => {
      setPoops(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Poops error:', err))
    return unsub
  }, [userId])

  async function addPoop(entry) {
    const id = generateId()
    await setDoc(doc(db, 'users', userId, 'poops', id), {
      id, ...entry, createdAt: new Date().toISOString(),
    })
    return id
  }

  async function deletePoop(id) {
    await deleteDoc(doc(db, 'users', userId, 'poops', id))
  }

  return { poops, addPoop, deletePoop }
}
