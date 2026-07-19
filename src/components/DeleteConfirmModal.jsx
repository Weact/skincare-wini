import { useState, useRef, useEffect } from 'react'

// Generic bulk-delete confirmation, used by every tracker's Select mode.
// Mirrors the app's existing tap-twice delete pattern (arm, then confirm
// within 3s) rather than a single irreversible click. `verb`/`bodyText` let
// a caller reuse this for a non-delete bulk action (e.g. Positions' "Hide")
// without changing the default wording anywhere else.
export default function DeleteConfirmModal({ items, onConfirm, onCancel, verb = 'Delete', bodyText }) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleConfirmClick() {
    if (armed) {
      clearTimeout(timerRef.current)
      onConfirm()
    } else {
      setArmed(true)
      timerRef.current = setTimeout(() => setArmed(false), 3000)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{verb} {items.length} item{items.length === 1 ? '' : 's'}?</span>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="field-hint">{bodyText || `This will permanently ${verb.toLowerCase()} the following:`}</p>
          <ul className="delete-confirm-list">
            {items.map(item => (
              <li key={item.id} className="delete-confirm-item">
                <span className="delete-confirm-label">{item.label}</span>
                {item.sublabel && <span className="delete-confirm-sublabel">{item.sublabel}</span>}
              </li>
            ))}
          </ul>
          <div className="delete-confirm-actions">
            <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`delete-btn${armed ? ' delete-btn--confirm' : ''}`}
              onClick={handleConfirmClick}
            >
              {armed ? 'Tap again to confirm' : `${verb} ${items.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
