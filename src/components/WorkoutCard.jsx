import { useState, useRef, useEffect } from 'react'
import { formatDisplayDate, formatEventTime } from '../utils/dateUtils'
import { formatExercise } from '../utils/workoutUtils'
import WorkoutForm from './WorkoutForm'

// One journal entry — reuses the product card look (collapsible header +
// body). Expanded body shows the exercises and notes; Edit swaps the body
// for the shared WorkoutForm in place.
export default function WorkoutCard({ workout, highlight = false, showDate = false, onUpdate, onDelete, onOpenCalendar, selectMode = false, selected = false, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])

  function handleDeleteClick() {
    if (confirmDelete) {
      clearTimeout(confirmTimerRef.current)
      onDelete()
    } else {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  function handleEditSubmit(payload) {
    onUpdate(payload)
    setEditing(false)
  }

  const meta = [
    showDate ? formatDisplayDate(workout.date) : null,
    workout.time ? formatEventTime(workout.time) : null,
    workout.duration ? `${workout.duration} min` : null,
    workout.calories ? `${workout.calories} kcal` : null,
    workout.exercises?.length
      ? `${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`
      : null,
    workout.location || null,
  ].filter(Boolean).join(' · ')

  const showBody = expanded && !selectMode

  return (
    <div className={`card${highlight ? ' card--week-highlight' : ''}${selectMode && selected ? ' card--selected' : ''}`}>
      <div className="card-header" onClick={selectMode ? onToggleSelect : () => setExpanded(e => !e)}>
        {selectMode && (
          <input
            type="checkbox"
            className="card-select-checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
          />
        )}
        <div className="card-header-left">
          <span className="wk-card-emoji">{workout.emoji || '🏋️'}</span>
          <div className="card-name-block">
            <span className="card-name">{workout.name}</span>
            {meta && <span className="card-dates">{meta}</span>}
          </div>
        </div>
        <div className="card-header-right">
          <span className="card-linked-icon" title="On the workout calendar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9.5h18" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          {!selectMode && (
            <span className={`chevron ${expanded ? 'chevron--up' : ''}`}>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
        </div>
      </div>

      {showBody && (
        <div className="card-body">
          {editing ? (
            <WorkoutForm
              initial={workout}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="field">
                <label className="field-label">In calendar</label>
                <button
                  type="button"
                  className="linked-date"
                  onClick={() => onOpenCalendar?.(workout)}
                >
                  <span className="linked-date-emoji">📅</span>
                  <div className="linked-date-info">
                    <span className="linked-date-name">
                      {formatDisplayDate(workout.date)}
                    </span>
                    <span className="linked-date-meta">
                      {[
                        workout.time ? formatEventTime(workout.time) : null,
                        'Open in workout calendar',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="linked-date-chevron">
                    <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {workout.exercises?.length > 0 && (
                <div className="field">
                  <label className="field-label">Exercises</label>
                  <ul className="wk-exercise-list">
                    {workout.exercises.map(ex => {
                      const detail = formatExercise(ex)
                      return (
                        <li key={ex.id} className="wk-exercise">
                          <span className="wk-exercise-name">{ex.name}</span>
                          {detail && <span className="wk-exercise-detail">{detail}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {workout.notes && (
                <div className="field">
                  <label className="field-label">Notes</label>
                  <p className="wk-notes-text">{workout.notes}</p>
                </div>
              )}

              <div className="wk-card-actions">
                <button className="photo-btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button
                  className={`delete-btn ${confirmDelete ? 'delete-btn--confirm' : ''}`}
                  onClick={handleDeleteClick}
                >
                  {confirmDelete ? 'Tap again to delete' : 'Delete workout'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
