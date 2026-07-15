import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Types are sub-categories — each one belongs to exactly one category (categoryId)
export function useTypes(userId) {
  const [types, setTypes] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'types')
    const q = query(colRef, orderBy('order'))
    const unsub = onSnapshot(q, snapshot => {
      setTypes(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Types error:', err))
    return unsub
  }, [userId])

  async function addType(name, emoji, categoryId) {
    const id = generateId()
    const siblings = types.filter(t => t.categoryId === categoryId)
    const order = siblings.length > 0
      ? Math.max(...siblings.map(t => t.order)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'types', id), {
      id, name, emoji: emoji || '', categoryId, order, createdAt: new Date().toISOString(),
    })
  }

  async function updateType(id, updates) {
    await setDoc(doc(db, 'users', userId, 'types', id), updates, { merge: true })
  }

  async function deleteType(id) {
    await deleteDoc(doc(db, 'users', userId, 'types', id))
  }

  return { types, addType, updateType, deleteType }
}
