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

export function useCategories(userId) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'categories')
    const q = query(colRef, orderBy('order'))
    const unsub = onSnapshot(q, snapshot => {
      setCategories(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Categories error:', err))
    return unsub
  }, [userId])

  async function addCategory(name, emoji) {
    const id = generateId()
    const order = categories.length > 0
      ? Math.max(...categories.map(c => c.order)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'categories', id), {
      id, name, emoji: emoji || '', order, createdAt: new Date().toISOString(),
    })
  }

  async function updateCategory(id, updates) {
    await setDoc(doc(db, 'users', userId, 'categories', id), updates, { merge: true })
  }

  async function deleteCategory(id) {
    await deleteDoc(doc(db, 'users', userId, 'categories', id))
  }

  async function reorderCategories(orderedCategories) {
    const batch = writeBatch(db)
    orderedCategories.forEach((cat, index) => {
      batch.set(doc(db, 'users', userId, 'categories', cat.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  return { categories, addCategory, updateCategory, deleteCategory, reorderCategories }
}
