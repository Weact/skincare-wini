import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// One doc per note. A note lives in exactly one place, resolved in this
// order: its category (when that category still exists), then its project,
// then nowhere at all — the Unfiled section. `projectId` is only ever read
// when `categoryId` is null, so dragging a category into another project
// carries every note inside it along without touching a single note doc.
//
// `order` is only ever compared between notes sharing a container (the same
// per-bucket numbering products and tasks use), so two categories reuse the
// same numbers by design — the containers themselves are ordered separately.
export function useNotes(userId) {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'notes')
    const unsub = onSnapshot(colRef, snapshot => {
      setNotes(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Notes error:', err))
    return unsub
  }, [userId])

  async function addNote(note) {
    const id = generateId()
    const projectId = note.projectId || null
    const categoryId = note.categoryId || null
    const bucket = notes.filter(n =>
      (n.categoryId || null) === categoryId && (n.projectId || null) === projectId)
    const order = bucket.length ? Math.max(...bucket.map(n => n.order ?? 0)) + 1 : 0
    const now = new Date().toISOString()
    await setDoc(doc(db, 'users', userId, 'notes', id), {
      id,
      title: note.title,
      content: note.content || '',
      projectId,
      categoryId,
      order,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  async function updateNote(id, updates) {
    await setDoc(doc(db, 'users', userId, 'notes', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  }

  async function deleteNote(id) {
    await deleteDoc(doc(db, 'users', userId, 'notes', id))
  }

  async function deleteNotes(ids) {
    if (ids.length === 0) return
    const batch = writeBatch(db)
    ids.forEach(id => batch.delete(doc(db, 'users', userId, 'notes', id)))
    await batch.commit()
  }

  // `orderedNotes` is one container's worth of notes, already in their new
  // on-screen order
  async function reorderNotes(orderedNotes) {
    if (orderedNotes.length === 0) return
    const batch = writeBatch(db)
    orderedNotes.forEach((n, index) => {
      batch.set(doc(db, 'users', userId, 'notes', n.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  // Moves one note into a new container while renumbering the whole
  // destination list in a single batch. `updatedAt` is deliberately left
  // alone — moving a note isn't editing it, and the list's "edited" stamp
  // shouldn't jump every time something is dragged.
  async function moveNote(noteId, fieldUpdates, orderedNotes) {
    const batch = writeBatch(db)
    orderedNotes.forEach((n, index) => {
      const updates = { order: index }
      if (n.id === noteId) Object.assign(updates, fieldUpdates)
      batch.set(doc(db, 'users', userId, 'notes', n.id), updates, { merge: true })
    })
    await batch.commit()
  }

  // Re-homes several notes at once, each with its own fields — what the
  // contents of a deleted category or project go through. `entries` is
  // [{ id, ...fields }].
  async function reassignNotes(entries) {
    if (entries.length === 0) return
    const batch = writeBatch(db)
    entries.forEach(({ id, ...fields }) => {
      batch.set(doc(db, 'users', userId, 'notes', id), fields, { merge: true })
    })
    await batch.commit()
  }

  return { notes, addNote, updateNote, deleteNote, deleteNotes, reorderNotes, moveNote, reassignNotes }
}
