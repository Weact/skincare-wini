import { useState, useEffect, useRef } from 'react'
import { formatDisplayDate, maskDateInput, parseDisplayDate } from '../utils/dateUtils'

// A date field you can either type or pick. The text box takes DD/MM/YYYY
// (slashes filled in as you type) and only reports a value once what's in it
// is a real calendar day; the calendar button on the right is a native date
// input, invisible except for the icon drawn under it, so tapping it opens
// the OS picker exactly as before.
export default function DateInput({ value, onChange, id, max }) {
  const [text, setText] = useState(() => formatDisplayDate(value) || '')
  const editingRef = useRef(false)

  // Follow the stored value whenever it changes from outside — a picked date,
  // an applied expiry suggestion, a form reset — but not while the user is
  // mid-keystroke, or their half-typed date would be rewritten under them.
  useEffect(() => {
    if (!editingRef.current) setText(formatDisplayDate(value) || '')
  }, [value])

  // Callers pass a plain input handler, so hand them the same shape the
  // native input would have.
  function emit(next) {
    onChange({ target: { value: next } })
  }

  function handleTextChange(e) {
    editingRef.current = true
    const masked = maskDateInput(e.target.value)
    setText(masked)
    if (masked === '') {
      emit('')
      return
    }
    const iso = parseDisplayDate(masked)
    if (iso && !(max && iso > max)) emit(iso)
  }

  // Anything left incomplete or impossible (31/02, or a date past `max`)
  // snaps back to the value that's actually stored, so the box never sits on
  // something the app didn't accept.
  function handleBlur() {
    editingRef.current = false
    setText(formatDisplayDate(value) || '')
  }

  return (
    <div className="date-field">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="field-input date-text"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="DD/MM/YYYY"
        maxLength={10}
      />
      <span className="date-picker-btn">
        <svg className="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 6.5H15" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 1V4M11 1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {/* Transparent native input sits on top of the icon — its own text is
            invisible, but it receives the tap and opens the OS date picker */}
        <input
          type="date"
          className="date-native"
          value={value || ''}
          onChange={onChange}
          max={max}
          aria-label="Pick a date"
        />
      </span>
    </div>
  )
}
