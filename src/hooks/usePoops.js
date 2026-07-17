import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Poop log — one doc per logged event (a day can have more than one), just
// a date + time + an `order` for the Custom-sort drag order. `order` is only
// ever compared between entries sharing the same date (like products' order
// within a category/type bucket), so different days can reuse the same
// numbers by design.
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
    const dayEntries = poops.filter(p => p.date === entry.date)
    const order = dayEntries.length
      ? Math.max(...dayEntries.map(p => p.order ?? 0)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'poops', id), {
      id, ...entry, order, createdAt: new Date().toISOString(),
    })
    return id
  }

  async function deletePoop(id) {
    await deleteDoc(doc(db, 'users', userId, 'poops', id))
  }

  async function reorderPoops(orderedPoops) {
    const batch = writeBatch(db)
    orderedPoops.forEach((p, index) => {
      batch.set(doc(db, 'users', userId, 'poops', p.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  return { poops, addPoop, deletePoop, reorderPoops }
}
