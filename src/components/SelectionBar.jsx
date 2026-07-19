// Shared "Select" / "Delete N" toolbar — reused at the top of every tracker
// so bulk deletion works the same way everywhere.
export default function SelectionBar({ selectMode, count, onToggle, onDeleteClick, actionLabel = 'Delete' }) {
  return (
    <div className="selection-bar">
      <button
        type="button"
        className={`selection-toggle-btn${selectMode ? ' selection-toggle-btn--active' : ''}`}
        onClick={onToggle}
      >
        {selectMode ? 'Cancel' : 'Select'}
      </button>
      {selectMode && count > 0 && (
        <button type="button" className="selection-delete-btn" onClick={onDeleteClick}>
          {actionLabel} {count}
        </button>
      )}
    </div>
  )
}
