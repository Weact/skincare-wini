import { useState, useRef, useEffect } from 'react'
import { todayISO, getMonthGrid, formatMonthYear, formatDayHeading, formatEventTime } from '../utils/dateUtils'
import { formatExercise } from '../utils/workoutUtils'
import WorkoutForm from './WorkoutForm'

// Workout mode's own calendar — same month-grid interaction as the skincare
// routine calendar, but it only knows about workouts (separate per mode by
// design; the header calendar button opens whichever matches the active mode).
export default function WorkoutCalendarModal({ workouts, addWorkout, updateWorkout, deleteWorkout, jumpTo, onClose }) {
  const today = todayISO()
  const now = new Date()
  const jumpDate = jumpTo?.date ? new Date(jumpTo.date + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(() => jumpDate ? jumpDate.getFullYear() : now.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => jumpDate ? jumpDate.getMonth() : now.getMonth())
  const [selectedDate, setSelectedDate] = useState(() => jumpTo?.date || today)

  const [showForm, setShowForm] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])

  // Opened via a workout card's "In calendar" link — open that workout for
  // editing. Mount-only: the modal fully unmounts/remounts each time it's
  // shown, so this runs once per open.
  useEffect(() => {
    if (jumpTo?.workoutId) {
      const w = workouts.find(x => x.id === jumpTo.workoutId)
      if (w) { setEditingWorkout(w); setShowForm(true) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byDate = {}
  workouts.forEach(w => {
    ;(byDate[w.date] ??= []).push(w)
  })
  Object.values(byDate).forEach(list =>
    list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
  )

  const grid = getMonthGrid(viewYear, viewMonth)
  const dayWorkouts = byDate[selectedDate] || []

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(dateStr) {
    setSelectedDate(dateStr)
    setShowForm(false)
    setEditingWorkout(null)
  }

  function handleSubmit(payload) {
    if (editingWorkout) {
      updateWorkout(editingWorkout.id, payload)
    } else {
      addWorkout(payload)
    }
    setShowForm(false)
    setEditingWorkout(null)
  }

  function handleDeleteClick(id) {
    if (confirmDeleteId === id) {
      clearTimeout(confirmTimerRef.current)
      deleteWorkout(id)
      setConfirmDeleteId(null)
      if (editingWorkout?.id === id) {
        setShowForm(false)
        setEditingWorkout(null)
      }
    } else {
      setConfirmDeleteId(id)
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet modal-sheet--calendar" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Workout Calendar</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                <path d="M7 1L2 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="cal-month-label">{formatMonthYear(viewYear, viewMonth)}</span>
            <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="cal-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="cal-grid">
            {grid.map((dateStr, i) => {
              if (!dateStr) return <span key={`empty-${i}`} className="cal-cell cal-cell--empty" />
              const count = (byDate[dateStr] || []).length
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}`}
                  onClick={() => selectDay(dateStr)}
                >
                  {parseInt(dateStr.slice(8), 10)}
                  {count > 0 && <span className="cal-dot" />}
                </button>
              )
            })}
          </div>

          <div className="cal-day-section">
            <div className="cal-day-heading">
              {selectedDate === today ? 'Today' : formatDayHeading(selectedDate)}
            </div>

            {dayWorkouts.length === 0 && !showForm && (
              <p className="cal-empty">No workouts logged</p>
            )}

            {dayWorkouts.length > 0 && (
              <ul className="cal-event-list">
                {dayWorkouts.map(w => (
                  <li
                    key={w.id}
                    className="cal-event"
                    onClick={() => { setEditingWorkout(w); setShowForm(true) }}
                  >
                    <span className="cal-event-emoji">{w.emoji || '🏋️'}</span>
                    <div className="cal-event-info">
                      <span className="cal-event-name">{w.name}</span>
                      <span className="cal-event-meta">
                        {[
                          w.time ? formatEventTime(w.time) : null,
                          w.duration ? `${w.duration} min` : null,
                          w.calories ? `${w.calories} kcal` : null,
                          w.exercises?.length
                            ? `${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}`
                            : null,
                          w.location || null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                      {w.exercises?.length > 0 && (
                        <span className="cal-event-product">
                          {w.exercises.slice(0, 3).map(ex =>
                            [ex.name, formatExercise(ex)].filter(Boolean).join(' ')
                          ).join(' · ')}
                          {w.exercises.length > 3 ? ' · …' : ''}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`cal-event-delete${confirmDeleteId === w.id ? ' cal-event-delete--confirm' : ''}`}
                      onClick={e => { e.stopPropagation(); handleDeleteClick(w.id) }}
                      aria-label={`Delete ${w.name}`}
                    >
                      {confirmDeleteId === w.id ? '✓' : '✕'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showForm ? (
              <WorkoutForm
                initial={editingWorkout}
                lockedDate={selectedDate}
                onSubmit={handleSubmit}
                onCancel={() => { setShowForm(false); setEditingWorkout(null) }}
              />
            ) : (
              <button className="new-cat-btn" onClick={() => { setEditingWorkout(null); setShowForm(true) }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Log workout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
