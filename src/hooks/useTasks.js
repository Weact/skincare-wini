import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// One doc per task. `date` is an ISO day or null (null = the Undated
// section); `categoryId` is at most one, `labelIds` is any number. `order`
// is only ever compared between tasks sharing the same date bucket (same
// idea as poops' per-day order and products' per-category order), so
// different days reuse the same numbers by design — the sections themselves
// are ordered by date, never by `order`.
export function useTasks(userId) {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'tasks')
    const unsub = onSnapshot(colRef, snapshot => {
      setTasks(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Tasks error:', err))
    return unsub
  }, [userId])

  async function addTask(task) {
    const id = generateId()
    const bucket = tasks.filter(t => (t.date || null) === (task.date || null))
    const order = bucket.length ? Math.max(...bucket.map(t => t.order ?? 0)) + 1 : 0
    await setDoc(doc(db, 'users', userId, 'tasks', id), {
      id,
      title: task.title,
      notes: task.notes || '',
      date: task.date || null,
      categoryId: task.categoryId || null,
      labelIds: task.labelIds || [],
      done: false,
      doneAt: null,
      order,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  // Moving a task to a different day puts it at the end of that day's
  // bucket — its old `order` came from a different bucket and would collide
  // arbitrarily with the tasks already there.
  async function updateTask(id, updates) {
    const next = { ...updates }
    if ('date' in updates) {
      const current = tasks.find(t => t.id === id)
      const from = current?.date || null
      const to = updates.date || null
      if (from !== to) {
        const bucket = tasks.filter(t => t.id !== id && (t.date || null) === to)
        next.order = bucket.length ? Math.max(...bucket.map(t => t.order ?? 0)) + 1 : 0
      }
    }
    await setDoc(doc(db, 'users', userId, 'tasks', id), next, { merge: true })
  }

  async function toggleTaskDone(id) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const nowDone = !task.done
    await setDoc(doc(db, 'users', userId, 'tasks', id), {
      done: nowDone,
      doneAt: nowDone ? new Date().toISOString() : null,
    }, { merge: true })
  }

  async function deleteTask(id) {
    await deleteDoc(doc(db, 'users', userId, 'tasks', id))
  }

  async function deleteTasks(ids) {
    if (ids.length === 0) return
    const batch = writeBatch(db)
    ids.forEach(id => batch.delete(doc(db, 'users', userId, 'tasks', id)))
    await batch.commit()
  }

  // `orderedTasks` is one date bucket, already in its new on-screen order
  async function reorderTasks(orderedTasks) {
    const batch = writeBatch(db)
    orderedTasks.forEach((t, index) => {
      batch.set(doc(db, 'users', userId, 'tasks', t.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  return { tasks, addTask, updateTask, toggleTaskDone, deleteTask, deleteTasks, reorderTasks }
}
