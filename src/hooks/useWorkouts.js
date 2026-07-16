import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Workout sessions — each one holds its own embedded exercises array
// ({ id, name, sets, reps, load }); exercises belong to exactly one workout,
// so they live inside the doc rather than in a separate collection.
export function useWorkouts(userId) {
  const [workouts, setWorkouts] = useState([])

  useEffect(() => {
    if (!userId) return
    const colRef = collection(db, 'users', userId, 'workouts')
    const unsub = onSnapshot(colRef, snapshot => {
      setWorkouts(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Workouts error:', err))
    return unsub
  }, [userId])

  async function addWorkout(workout) {
    const id = generateId()
    await setDoc(doc(db, 'users', userId, 'workouts', id), {
      id, ...workout, createdAt: new Date().toISOString(),
    })
    return id
  }

  async function updateWorkout(id, updates) {
    await setDoc(doc(db, 'users', userId, 'workouts', id), updates, { merge: true })
  }

  async function deleteWorkout(id) {
    await deleteDoc(doc(db, 'users', userId, 'workouts', id))
  }

  return { workouts, addWorkout, updateWorkout, deleteWorkout }
}
