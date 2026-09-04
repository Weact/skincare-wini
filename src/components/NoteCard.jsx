import NoteForm from './NoteForm'

// Collapsed, a note shows its title, a one-line preview of the body and
// when it was last edited. Tapping it opens the body in full, with Edit and
// Delete underneath — same "detail behind a tap" shape as a task row, so a
// long note can't push everything else off the screen while you're
// reorganising the tracker.
export default function NoteCard({
  note,
  expanded,
  onToggleExpand,
  editing = false,
  locationOptions = [],
  currentLocation = "root",
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
  readOnly = false,
  dragHandleProps = null,
}) {
  const preview = (note.content || '').replace(/\s+/g, ' ').trim()

  function handleClick() {
    if (selectMode) { onToggleSelect?.(note.id); return }
    onToggleExpand?.(note.id)
  }

  if (editing) {
    return (
      <div className="note-card note-card--editing">
        <NoteForm
          initial={note}
          heading="Editing note"
          locationOptions={locationOptions}
          defaultLocation={currentLocation}
          onSubmit={values => onSubmitEdit?.(note.id, values)}
          onCancel={onCancelEdit}
        />
      </div>
    )
  }

  return (
    <div className={`note-card${selectMode && selected ? ' note-card--selected' : ''}`}>
      <div className="note-card-main">
        {dragHandleProps && !selectMode && !readOnly && (
          <span className="product-drag-handle" {...dragHandleProps} onClick={e => e.stopPropagation()}>
            <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
              <circle cx="3.5" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="3.5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="3.5" cy="13" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
            </svg>
          </span>
        )}

        {selectMode && (
          <span className={`task-select-box${selected ? ' task-select-box--on' : ''}`} aria-hidden="true">
            {selected ? '✓' : ''}
          </span>
        )}

        <button type="button" className="note-card-body" onClick={handleClick}>
          <span className="note-title">{note.title}</span>
          {!expanded && preview && <span className="note-preview">{preview}</span>}
        </button>

        <span className={`chevron${expanded ? ' chevron--up' : ''}`} aria-hidden="true">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>

      {expanded && !selectMode && (
        <div className="note-card-detail">
          {note.content
            ? <p className="note-content">{note.content}</p>
            : <p className="note-content note-content--empty">This note is empty.</p>}
          {!readOnly && (
            <div className="task-row-actions">
              <button type="button" className="task-action-btn" onClick={() => onStartEdit?.(note.id)}>
                Edit
              </button>
              <button type="button" className="task-action-btn task-action-btn--danger" onClick={() => onDelete?.(note.id)}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
