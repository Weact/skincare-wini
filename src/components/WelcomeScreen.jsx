// Shown instead of the tracker view when every tracker is unchecked in
// Settings — the app has nothing to display until at least one is enabled.
export default function WelcomeScreen({ onOpenSettings }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">✨</div>
      <p className="empty-title">Pick a tracker to get started</p>
      <p className="empty-text">
        Enable Skincare, Workouts, or both from Settings to start tracking.
      </p>
      <button className="cat-save-btn" onClick={onOpenSettings}>Open Settings</button>
    </div>
  )
}
