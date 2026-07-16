import { useState, useRef, useEffect } from 'react'
import { HOURS, MINUTES, WORKOUT_INTENSITIES } from '../constants'
import { todayISO } from '../utils/dateUtils'
import DateInput from './DateInput'
import EmojiPicker from './EmojiPicker'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function emptyExercise() {
  return { id: generateId(), name: '', sets: '', reps: '', load: '' }
}

// Shared add/edit workout form — used inline in the journal and inside the
// workout calendar. `initial` = existing workout to edit (null = new);
// `lockedDate` pins the date field (calendar's "add on this day" flow).
export default function WorkoutForm({ initial = null, lockedDate = null, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [emoji, setEmoji] = useState(initial?.emoji || '')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [date, setDate] = useState(initial?.date || lockedDate || todayISO())
  const [location, setLocation] = useState(initial?.location || '')
  const [time, setTime] = useState(initial?.time || '')
  const [duration, setDuration] = useState(initial?.duration ? String(initial.duration) : '')
  const [calories, setCalories] = useState(initial?.calories ? String(initial.calories) : '')
  const [intensity, setIntensity] = useState(initial?.intensity || 'moderate')
  const [weightDraft, setWeightDraft] = useState(() => localStorage.getItem('bodyWeightKg') || '')
  const [needWeight, setNeedWeight] = useState(false)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [exercises, setExercises] = useState(() =>
    initial?.exercises?.length
      ? initial.exercises.map(ex => ({
          ...ex,
          sets: ex.sets ? String(ex.sets) : '',
          reps: ex.reps ? String(ex.reps) : '',
          load: ex.load || '',
        }))
      : [emptyExercise()]
  )
  const emojiRef = useRef(null)

  const [timeHour, timeMinute] = time ? time.split(':') : ['', '']

  useEffect(() => {
    function handle(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  function updateExercise(id, patch) {
    setExercises(list => list.map(ex => ex.id === id ? { ...ex, ...patch } : ex))
  }

  function removeExercise(id) {
    setExercises(list => list.filter(ex => ex.id !== id))
  }

  function addExercise() {
    setExercises(list => [...list, emptyExercise()])
  }

  // kcal ≈ MET × body weight (kg) × duration (h) — needs duration, an
  // intensity, and the user's weight (asked once, then kept on this device)
  function estimateCalories() {
    const mins = duration ? parseInt(duration) : 0
    if (!mins) return
    const kg = weightDraft ? parseFloat(weightDraft) : 0
    if (!kg) {
      setNeedWeight(true)
      return
    }
    localStorage.setItem('bodyWeightKg', String(kg))
    setNeedWeight(false)
    const met = WORKOUT_INTENSITIES.find(i => i.key === intensity)?.met || 5
    setCalories(String(Math.round(met * kg * (mins / 60))))
  }

  function submit() {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      emoji,
      date,
      location: location.trim() || null,
      time: time || null,
      duration: duration ? parseInt(duration) : null,
      calories: calories ? parseInt(calories) : null,
      intensity,
      notes: notes.trim(),
      // Drop blank rows; store sets/reps as numbers, load as trimmed text
      exercises: exercises
        .filter(ex => ex.name.trim())
        .map(ex => ({
          id: ex.id,
          name: ex.name.trim(),
          sets: ex.sets ? parseInt(ex.sets) : null,
          reps: ex.reps ? parseInt(ex.reps) : null,
          load: ex.load.trim() || null,
        })),
    })
  }

  return (
    <div className="wk-form">
      <div className="wk-form-row" ref={emojiRef}>
        <button type="button" className="cat-emoji-btn" onClick={() => setShowEmojiPicker(s => !s)}>
          {emoji || '🏋️'}
        </button>
        {showEmojiPicker && (
          <EmojiPicker
            value={emoji}
            onSelect={e => { setEmoji(e); setShowEmojiPicker(false) }}
          />
        )}
        <input
          type="text"
          className="field-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workout name — e.g. Push Day"
          autoFocus
        />
      </div>

      <div className="field">
        <label className="field-label">Location</label>
        <input
          type="text"
          className="field-input"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Home, Gym, Park"
        />
      </div>

      <div className="cal-form-grid">
        <div className="field">
          <label className="field-label">Date</label>
          {lockedDate && !initial ? (
            <div className="field-input wk-date-locked">{date.split('-').reverse().join('/')}</div>
          ) : (
            <DateInput value={date} onChange={e => setDate(e.target.value || todayISO())} />
          )}
        </div>
        <div className="field">
          <label className="field-label">Duration</label>
          <div className="cal-duration-input">
            <input
              type="number"
              min="1"
              className="field-input"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="45"
            />
            <span className="cal-duration-suffix">min</span>
          </div>
        </div>
      </div>

      <div className="cal-form-grid">
        <div className="field">
          <label className="field-label">Time (24h)</label>
          <div className="cal-time-select-row">
            <select
              className="field-input field-select"
              value={timeHour}
              onChange={e => setTime(e.target.value ? `${e.target.value}:${timeMinute || '00'}` : '')}
            >
              <option value="">--</option>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="cal-time-colon">:</span>
            <select
              className="field-input field-select"
              value={timeMinute}
              onChange={e => setTime(e.target.value ? `${timeHour || '00'}:${e.target.value}` : '')}
            >
              <option value="">--</option>
              {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label">Calories</label>
          <div className="wk-cal-row">
            <div className="cal-duration-input">
              <input
                type="number"
                min="1"
                className="field-input"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                placeholder="320"
              />
              <span className="cal-duration-suffix">kcal</span>
            </div>
            <button
              type="button"
              className="wk-auto-btn"
              onClick={estimateCalories}
              disabled={!duration}
              title="Estimate from duration, intensity and body weight"
            >
              Auto
            </button>
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Intensity</label>
        <div className="cal-tod-row">
          {WORKOUT_INTENSITIES.map(i => (
            <button
              key={i.key}
              type="button"
              className={`cal-tod-btn${intensity === i.key ? ' cal-tod-btn--active' : ''}`}
              onClick={() => setIntensity(i.key)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {needWeight && (
        <div className="field">
          <label className="field-label">Your body weight</label>
          <div className="field-hint">
            Needed once for the calorie estimate (kcal ≈ MET × kg × hours) — kept on this device only
          </div>
          <div className="wk-cal-row">
            <div className="cal-duration-input">
              <input
                type="number"
                min="1"
                className="field-input"
                value={weightDraft}
                onChange={e => setWeightDraft(e.target.value)}
                placeholder="70"
                autoFocus
              />
              <span className="cal-duration-suffix">kg</span>
            </div>
            <button type="button" className="wk-auto-btn" onClick={estimateCalories}>
              Estimate
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label">Exercises</label>
        <div className="wk-exercise-rows">
          {exercises.map(ex => (
            <div key={ex.id} className="wk-exercise-row">
              <input
                type="text"
                className="field-input wk-ex-name"
                value={ex.name}
                onChange={e => updateExercise(ex.id, { name: e.target.value })}
                placeholder="Exercise"
              />
              <input
                type="number"
                min="1"
                className="field-input wk-ex-num"
                value={ex.sets}
                onChange={e => updateExercise(ex.id, { sets: e.target.value })}
                placeholder="Sets"
              />
              <span className="wk-ex-x">×</span>
              <input
                type="number"
                min="1"
                className="field-input wk-ex-num"
                value={ex.reps}
                onChange={e => updateExercise(ex.id, { reps: e.target.value })}
                placeholder="Reps"
              />
              <input
                type="text"
                className="field-input wk-ex-load"
                value={ex.load}
                onChange={e => updateExercise(ex.id, { load: e.target.value })}
                placeholder="kg / km"
              />
              <button
                type="button"
                className="wk-ex-remove"
                onClick={() => removeExercise(ex.id)}
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="wk-add-exercise-btn" onClick={addExercise}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Add exercise
        </button>
      </div>

      <div className="field">
        <label className="field-label">Notes</label>
        <textarea
          className="field-input wk-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. New PR on bench"
          rows={2}
        />
      </div>

      <div className="cal-event-form-actions">
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onCancel}>Cancel</button>
        <button type="button" className="cat-save-btn" onClick={submit}>
          {initial ? 'Save' : 'Log workout'}
        </button>
      </div>
    </div>
  )
}
