// Shared "Select" / "Delete N" toolbar — reused at the top of every tracker
// so bulk deletion works the same way everywhere.
// `rightSlot` parks a tracker-specific control at the far right of the same
// row (the skincare tracker's Expiring button), clear of the Delete N button
// that appears next to Select once you're selecting.
export default function SelectionBar({ selectMode, count, onToggle, onDeleteClick, actionLabel = 'Delete', rightSlot }) {
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
      {rightSlot && <div className="selection-bar-right">{rightSlot}</div>}
    </div>
  )
}
