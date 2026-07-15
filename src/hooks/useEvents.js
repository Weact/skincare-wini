import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Skincare routine events, scheduled on a specific date
export function useEvents(userId) {
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'events')
    const unsub = onSnapshot(colRef, snapshot => {
      setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Events error:', err))
    return unsub
  }, [userId])

  async function addEvent(event) {
    const id = generateId()
    await setDoc(doc(db, 'users', userId, 'events', id), {
      id, ...event, createdAt: new Date().toISOString(),
    })
  }

  async function updateEvent(id, updates) {
    await setDoc(doc(db, 'users', userId, 'events', id), updates, { merge: true })
  }

  async function deleteEvent(id) {
    await deleteDoc(doc(db, 'users', userId, 'events', id))
  }

  return { events, addEvent, updateEvent, deleteEvent }
}
