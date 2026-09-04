import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Projects are the Notes tracker's outermost tier: a project holds
// categories and/or notes directly, and is allowed to hold nothing at all.
// Deleting one never cascades — the tracker re-homes whatever was inside
// first, so a project is only ever a container, never an owner.
export function useNoteProjects(userId) {
  const [noteProjects, setNoteProjects] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'noteProjects')
    const unsub = onSnapshot(query(colRef, orderBy('order')), snapshot => {
      setNoteProjects(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Note projects error:', err))
    return unsub
  }, [userId])

  async function addNoteProject(name, emoji) {
    const id = generateId()
    const order = noteProjects.length
      ? Math.max(...noteProjects.map(p => p.order ?? 0)) + 1
      : 0
    await setDoc(doc(db, 'users', userId, 'noteProjects', id), {
      id, name, emoji: emoji || '', order, createdAt: new Date().toISOString(),
    })
    return id
  }

  async function updateNoteProject(id, updates) {
    await setDoc(doc(db, 'users', userId, 'noteProjects', id), updates, { merge: true })
  }

  async function deleteNoteProject(id) {
    await deleteDoc(doc(db, 'users', userId, 'noteProjects', id))
  }

  async function reorderNoteProjects(orderedProjects) {
    const batch = writeBatch(db)
    orderedProjects.forEach((p, index) => {
      batch.set(doc(db, 'users', userId, 'noteProjects', p.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  return { noteProjects, addNoteProject, updateNoteProject, deleteNoteProject, reorderNoteProjects }
}
