import { useState, useRef, useEffect, useId } from 'react'

// One control for picking a place in the notes tree — used both for "what
// am I looking at" at the top of the tracker and for "where does this go"
// in the note and category forms. A native <select> can't be styled past
// its closed state (the dropdown is drawn by the OS), so this is a real
// listbox, which is what lets an option carry its emoji, its project prefix
// and its note count as separate pieces rather than one run of text.
//
// `options` is a flat list of { value, emoji, label, prefix, count, group };
// consecutive options sharing a `group` get one heading above them, and
// `count` is optional — a destination has no reason to say how full it is.
export default function NoteTreePicker({ options, value, onChange, label = 'Show' }) {
  const [open, setOpen] = useState(false)
  // Several of these can be on screen at once — the scope bar plus an open
  // note form — so the listbox ids have to be per-instance or aria-controls
  // and aria-activedescendant would all point at the first one
  const uid = useId()
  const listId = `note-picker-${uid}`
  // Which row the keyboard is on. Kept apart from `value` so arrowing
  // around doesn't change the view until you actually pick something.
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef(null)
  const listRef = useRef(null)

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [open])

  // Open on the current choice, not at the top — with a long list the
  // selected row would otherwise be somewhere off-screen
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function pick(next) {
    onChange(next)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const option = options[activeIndex]
      if (option) pick(option.value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="note-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`note-picker-trigger${open ? ' note-picker-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-opt-${activeIndex}` : undefined}
        aria-label={`${label}: ${selected?.label || 'none'}`}
      >
        <span className="note-picker-trigger-emoji">{selected?.emoji || '📄'}</span>
        <span className="note-picker-trigger-text">
          {selected?.prefix && <span className="note-picker-prefix">{selected.prefix}</span>}
          {selected?.label}
        </span>
        {selected?.count != null && <span className="note-picker-count">{selected.count}</span>}
        <span className={`note-picker-caret${open ? ' note-picker-caret--open' : ''}`} aria-hidden="true">
          <svg width="11" height="7" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div
          className="note-picker-menu"
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label={label}
        >
          {options.map((option, i) => {
            // One heading per run of options sharing a group, so the
            // divider is drawn by the first member rather than needing a
            // separate nested list
            const startsGroup = option.group && options[i - 1]?.group !== option.group
            const isSelected = option.value === value
            return (
              <div key={option.value}>
                {startsGroup && <div className="note-picker-group">{option.group}</div>}
                <div
                  id={`${listId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={[
                    'note-picker-opt',
                    isSelected ? 'note-picker-opt--selected' : '',
                    i === activeIndex ? 'note-picker-opt--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pick(option.value)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="note-picker-opt-emoji">{option.emoji}</span>
                  <span className="note-picker-opt-text">
                    {option.prefix && <span className="note-picker-prefix">{option.prefix}</span>}
                    {option.label}
                  </span>
                  {option.count != null && <span className="note-picker-count">{option.count}</span>}
                  <span className="note-picker-tick" aria-hidden="true">
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1.5 6.2l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
