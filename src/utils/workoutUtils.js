// "3×10 @ 60kg", "3×10", "60kg", "5km" — sets/reps pair up with ×, the
// free-text load ("60kg", "5km", "band") joins with @ only when there's a
// sets/reps part in front of it, matching how lifters write it
export function formatExercise(ex) {
  const setsReps = ex.sets && ex.reps
    ? `${ex.sets}×${ex.reps}`
    : ex.sets
      ? `${ex.sets} sets`
      : ex.reps
        ? `${ex.reps} reps`
        : null
  if (setsReps && ex.load) return `${setsReps} @ ${ex.load}`
  return setsReps || ex.load || null
}

// ISO date (YYYY-MM-DD) of the Monday of the week containing `d`
export function mondayOfWeek(d) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const day = (copy.getDay() + 6) % 7 // 0 = Monday
  copy.setDate(copy.getDate() - day)
  return toISO(copy)
}

// ISO date of the Sunday closing the week containing `d`
export function sundayOfWeek(d) {
  const copy = new Date(mondayOfWeek(d) + 'T00:00:00')
  copy.setDate(copy.getDate() + 6)
  return toISO(copy)
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
