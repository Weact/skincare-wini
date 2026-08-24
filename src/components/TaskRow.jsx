import { DEFAULT_LABEL_COLOR } from '../constants'

// One task in a list. Kept deliberately compact — the Today/This week panes
// can be dragged down to roughly a third of the screen each, so the row has
// to stay readable at ~140px wide. Notes and the Edit/Delete actions live
// behind a tap on the row rather than always being on screen.
export default function TaskRow({
  task,
  category,
  labels = [],
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
  readOnly = false,
  overdue = false,
  dateLabel = null,
  tone = null,
  lateLabel = null,
  editing = false,
  dragHandleProps = null,
}) {
  // The date lives on the row rather than in a heading above it, so the
  // rows run as one unbroken column. `tone` (past / today / future) is what
  // says how urgent a task is — colour on a date reads on its own, where
  // colour on a border has to be learned first.
  const hasMeta = !!category || labels.length > 0

  function handleRowClick() {
    if (selectMode) { onToggleSelect?.(task.id); return }
    onToggleExpand?.(task.id)
  }

  return (
    <div
      className={[
        'task-row',
        task.done ? 'task-row--done' : '',
        overdue && !task.done ? 'task-row--overdue' : '',
        selectMode && selected ? 'task-row--selected' : '',
        editing ? 'task-row--editing' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="task-row-main">
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

        {selectMode ? (
          <span className={`task-select-box${selected ? ' task-select-box--on' : ''}`} aria-hidden="true">
            {selected ? '✓' : ''}
          </span>
        ) : (
          <button
            type="button"
            className={`task-check${task.done ? ' task-check--on' : ''}`}
            onClick={e => { e.stopPropagation(); if (!readOnly) onToggleDone?.(task.id) }}
            disabled={readOnly}
            aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
            aria-pressed={!!task.done}
          >
            {task.done && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 6.2l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}

        <button type="button" className="task-row-body" onClick={handleRowClick}>
          <span className="task-title">{task.title}</span>
          {dateLabel && (
            <span className={`task-date task-date--${tone}`}>
              {dateLabel}
              {lateLabel && <span className="task-date-late"> · {lateLabel}</span>}
            </span>
          )}
          {hasMeta && (
            <span className="task-meta">
              {category && (
                <span className="task-cat-chip">
                  {category.emoji && <span className="task-chip-emoji">{category.emoji}</span>}
                  {category.name}
                </span>
              )}
              {labels.map(l => (
                <span
                  key={l.id}
                  className={`task-label-chip task-label-chip--${l.color || DEFAULT_LABEL_COLOR}`}
                >
                  {l.emoji && <span className="task-chip-emoji">{l.emoji}</span>}
                  {l.name}
                </span>
              ))}
            </span>
          )}
          {task.notes && !expanded && <span className="task-note-dot" aria-label="Has notes">•••</span>}
        </button>
      </div>

      {expanded && !selectMode && (
        <div className="task-row-detail">
          {task.notes && <p className="task-notes">{task.notes}</p>}
          {!readOnly && (
            <div className="task-row-actions">
              <button type="button" className="task-action-btn" onClick={() => onEdit?.(task)}>Edit</button>
              <button type="button" className="task-action-btn task-action-btn--danger" onClick={() => onDelete?.(task.id)}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
