import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Note categories are the middle tier: each one sits either inside a project
// (`projectId`) or on its own at the root (`projectId: null`), and may hold
// no notes at all. `order` is only ever compared between categories sharing
// a parent — the same per-bucket numbering products and tasks use — so two
// projects reuse the same numbers by design.
//
// Deliberately its own collection rather than a reuse of `categories`
// (skincare) or `taskCategories`: the three trackers must not pollute each
// other's lists, and friend-visibility is gated per tracker.
export function useNoteCategories(userId) {
  const [noteCategories, setNoteCategories] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'noteCategories')
    const unsub = onSnapshot(query(colRef, orderBy('order')), snapshot => {
      setNoteCategories(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Note categories error:', err))
    return unsub
  }, [userId])

  async function addNoteCategory(name, emoji, projectId = null) {
    const id = generateId()
    const siblings = noteCategories.filter(c => (c.projectId || null) === (projectId || null))
    const order = siblings.length ? Math.max(...siblings.map(c => c.order ?? 0)) + 1 : 0
    await setDoc(doc(db, 'users', userId, 'noteCategories', id), {
      id,
      name,
      emoji: emoji || '',
      projectId: projectId || null,
      order,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  async function updateNoteCategory(id, updates) {
    await setDoc(doc(db, 'users', userId, 'noteCategories', id), updates, { merge: true })
  }

  async function deleteNoteCategory(id) {
    await deleteDoc(doc(db, 'users', userId, 'noteCategories', id))
  }

  async function reorderNoteCategories(orderedCategories) {
    const batch = writeBatch(db)
    orderedCategories.forEach((c, index) => {
      batch.set(doc(db, 'users', userId, 'noteCategories', c.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  // Moves one category into a new project while renumbering the whole
  // destination list in one batch (same shape as useProducts' moveProduct)
  async function moveNoteCategory(categoryId, fieldUpdates, orderedCategories) {
    const batch = writeBatch(db)
    orderedCategories.forEach((c, index) => {
      const updates = { order: index }
      if (c.id === categoryId) Object.assign(updates, fieldUpdates)
      batch.set(doc(db, 'users', userId, 'noteCategories', c.id), updates, { merge: true })
    })
    await batch.commit()
  }

  // Re-homes several categories at once, each with its own fields — what a
  // deleted project's contents go through on their way back to the root.
  // `entries` is [{ id, ...fields }].
  async function reassignNoteCategories(entries) {
    if (entries.length === 0) return
    const batch = writeBatch(db)
    entries.forEach(({ id, ...fields }) => {
      batch.set(doc(db, 'users', userId, 'noteCategories', id), fields, { merge: true })
    })
    await batch.commit()
  }

  return {
    noteCategories,
    addNoteCategory,
    updateNoteCategory,
    deleteNoteCategory,
    reorderNoteCategories,
    moveNoteCategory,
    reassignNoteCategories,
  }
}
