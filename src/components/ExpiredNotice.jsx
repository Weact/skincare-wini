import { useEffect, useState } from 'react'

const AUTO_HIDE_MS = 12000

// Shown when an edit tips a product past one of its dates, which lifts its
// card out of its category and into the Expired section — without this the
// card just vanishes from under the user. A corner notice rather than a
// modal: it's announced politely, never takes focus or blocks the page, and
// fades on its own unless the pointer or keyboard is on it. Undo puts the
// edited fields back.
export default function ExpiredNotice({ name, reason, onUndo, onClose }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setTimeout(onClose, AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [paused, onClose])

  return (
    <div
      className="expired-notice"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false) }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div className="expired-notice-head">
        <svg className="expired-notice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 7v5.5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="expired-notice-title">Moved to Expired</span>
        <button type="button" className="expired-notice-close" onClick={onClose} aria-label="Dismiss">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <p className="expired-notice-text">
        <strong>{name || 'Unnamed product'}</strong> {reason}. It's now in the Expired
        section at the bottom of the list.
      </p>
      <div className="expired-notice-actions">
        <button type="button" className="expired-notice-btn" onClick={onUndo}>Undo</button>
        <button type="button" className="expired-notice-btn expired-notice-btn--primary" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}
