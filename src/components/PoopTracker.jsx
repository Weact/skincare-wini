import { useState, useEffect, useRef } from 'react'
import { todayISO, getMonthGrid, formatMonthYear, formatDayHeading, formatEventTime } from '../utils/dateUtils'
import { POOP_FEELINGS } from '../constants'

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// The more logged in a day, the goofier that day's marker gets — bigger and
// wobblier past a couple, matching the tracker's lighthearted tone
function poopTierClass(count) {
  if (count >= 5) return 'poop-dot--4'
  if (count >= 3) return 'poop-dot--3'
  if (count >= 2) return 'poop-dot--2'
  return ''
}

// Poop tracker's entire view IS the calendar — no journal list alongside it
// like the other trackers. Tap a day to see, add, or remove its entries.
export default function PoopTracker({ poops, addPoop, deletePoop }) {
  const today = todayISO()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimerRef = useRef(null)
  const [pickingFeeling, setPickingFeeling] = useState(false)

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])
  useEffect(() => setPickingFeeling(false), [selectedDate])

  const byDate = {}
  poops.forEach(p => { (byDate[p.date] ??= []).push(p) })
  Object.values(byDate).forEach(list => list.sort((a, b) => (a.time || '').localeCompare(b.time || '')))

  const grid = getMonthGrid(viewYear, viewMonth)
  const dayEntries = byDate[selectedDate] || []

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function chooseFeeling(feeling) {
    addPoop({ date: selectedDate, time: nowTime(), feeling })
    setPickingFeeling(false)
  }

  function handleDeleteClick(id) {
    if (confirmDeleteId === id) {
      clearTimeout(confirmTimerRef.current)
      deletePoop(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="poop-tracker">
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
              onClick={() => setSelectedDate(dateStr)}
            >
              {parseInt(dateStr.slice(8), 10)}
              {count > 0 && <span className={`poop-dot ${poopTierClass(count)}`}>💩</span>}
            </button>
          )
        })}
      </div>

      <div className="cal-day-section">
        <div className="cal-day-heading">
          {selectedDate === today ? 'Today' : formatDayHeading(selectedDate)}
        </div>

        {dayEntries.length === 0 ? (
          <p className="cal-empty">Nothing logged</p>
        ) : (
          <ul className="cal-event-list">
            {dayEntries.map(p => {
              const feeling = POOP_FEELINGS.find(f => f.key === p.feeling)
              return (
                <li key={p.id} className="cal-event">
                  <span className="cal-event-emoji">{feeling?.icon || '💩'}</span>
                  <div className="cal-event-info">
                    <span className="cal-event-name">{formatEventTime(p.time) || 'Logged'}</span>
                    {feeling && <span className="cal-event-meta">{feeling.label}</span>}
                  </div>
                  <button
                    type="button"
                    className={`cal-event-delete${confirmDeleteId === p.id ? ' cal-event-delete--confirm' : ''}`}
                    onClick={() => handleDeleteClick(p.id)}
                    aria-label="Delete entry"
                  >
                    {confirmDeleteId === p.id ? '✓' : '✕'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {pickingFeeling ? (
          <div className="field">
            <label className="field-label">How did it feel?</label>
            <div className="cal-tod-row">
              {POOP_FEELINGS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  className="cal-tod-btn"
                  onClick={() => chooseFeeling(f.key)}
                >
                  <span>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cat-cancel-btn cat-cancel-btn--text"
              onClick={() => setPickingFeeling(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="new-cat-btn" onClick={() => setPickingFeeling(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Log 💩
          </button>
        )}
      </div>
    </div>
  )
}
