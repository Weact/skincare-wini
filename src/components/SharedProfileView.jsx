import { useState } from 'react'
import { useSharedProfile } from '../hooks/useSharedProfile'
import { useWorkouts } from '../hooks/useWorkouts'
import { usePoops } from '../hooks/usePoops'
import WorkoutTracker from './WorkoutTracker'
import PoopTracker from './PoopTracker'

const ERROR_MESSAGES = {
  'not-found': "That code doesn't match any profile.",
  'private': "This profile isn't shared with you — it may be private, or you're not on their whitelist.",
}

// Read-only view of someone else's shared Workouts + Poop data, reached by
// entering their profile code in Settings. Reuses the same tracker
// components in `readOnly` mode rather than building a separate viewer.
export default function SharedProfileView({ code, onExit }) {
  const { loading, uid, error } = useSharedProfile(code)
  const [viewMode, setViewMode] = useState('workout')
  const { workouts } = useWorkouts(uid)
  const { poops } = usePoops(uid)

  return (
    <div className="shared-profile">
      <div className="shared-profile-header">
        <span className="shared-profile-title">👀 Viewing {code}</span>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onExit}>
          Exit
        </button>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <p className="empty-title">Can't view this profile</p>
          <p className="empty-text">{ERROR_MESSAGES[error] || 'Something went wrong.'}</p>
        </div>
      ) : (
        <>
          <div className="mode-switch" role="tablist" aria-label="Shared data">
            <button
              role="tab"
              aria-selected={viewMode === 'workout'}
              className={`mode-switch-btn${viewMode === 'workout' ? ' mode-switch-btn--active' : ''}`}
              onClick={() => setViewMode('workout')}
            >
              <span className="mode-switch-icon">🏋️</span>
              <span className="mode-switch-label">Workouts</span>
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'poop'}
              className={`mode-switch-btn${viewMode === 'poop' ? ' mode-switch-btn--active' : ''}`}
              onClick={() => setViewMode('poop')}
            >
              <span className="mode-switch-icon">💩</span>
              <span className="mode-switch-label">Poop</span>
            </button>
          </div>

          {viewMode === 'workout' ? (
            <WorkoutTracker
              workouts={workouts}
              steps={[]}
              logSteps={() => {}}
              addWorkout={() => {}}
              updateWorkout={() => {}}
              deleteWorkout={() => {}}
              readOnly
            />
          ) : (
            <PoopTracker
              poops={poops}
              addPoop={() => {}}
              deletePoop={() => {}}
              reorderPoops={() => {}}
              readOnly
            />
          )}
        </>
      )}
    </div>
  )
}
