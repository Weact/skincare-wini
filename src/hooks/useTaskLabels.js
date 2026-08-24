import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_LABEL_COLOR } from '../constants'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Task labels — the many-per-task counterpart to a task's single category.
// Same shape as a category (name + emoji) so both can share the EmojiPicker
// and chip UI, plus a `color` key from TASK_LABEL_COLORS.
export function useTaskLabels(userId) {
  const [taskLabels, setTaskLabels] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'taskLabels')
    const unsub = onSnapshot(query(colRef, orderBy('order')), snapshot => {
      setTaskLabels(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Task labels error:', err))
    return unsub
  }, [userId])

  async function addTaskLabel(name, emoji, color) {
    const id = generateId()
    const order = taskLabels.length
      ? Math.max(...taskLabels.map(l => l.order ?? 0)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'taskLabels', id), {
      id,
      name,
      emoji: emoji || '',
      color: color || DEFAULT_LABEL_COLOR,
      order,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  async function updateTaskLabel(id, updates) {
    await setDoc(doc(db, 'users', userId, 'taskLabels', id), updates, { merge: true })
  }

  async function deleteTaskLabel(id) {
    await deleteDoc(doc(db, 'users', userId, 'taskLabels', id))
  }

  return { taskLabels, addTaskLabel, updateTaskLabel, deleteTaskLabel }
}
