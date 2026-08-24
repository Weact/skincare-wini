import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Task categories — deliberately its own collection rather than reusing
// the skincare `categories` one, so the two trackers can't pollute each
// other's lists (and so friend-visibility can be gated per tracker).
export function useTaskCategories(userId) {
  const [taskCategories, setTaskCategories] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'taskCategories')
    const unsub = onSnapshot(query(colRef, orderBy('order')), snapshot => {
      setTaskCategories(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Task categories error:', err))
    return unsub
  }, [userId])

  async function addTaskCategory(name, emoji) {
    const id = generateId()
    const order = taskCategories.length
      ? Math.max(...taskCategories.map(c => c.order ?? 0)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'taskCategories', id), {
      id, name, emoji: emoji || '', order, createdAt: new Date().toISOString(),
    })
    return id
  }

  async function updateTaskCategory(id, updates) {
    await setDoc(doc(db, 'users', userId, 'taskCategories', id), updates, { merge: true })
  }

  async function deleteTaskCategory(id) {
    await deleteDoc(doc(db, 'users', userId, 'taskCategories', id))
  }

  return { taskCategories, addTaskCategory, updateTaskCategory, deleteTaskCategory }
}
