import { useState } from 'react'
import { useWorkouts } from '../hooks/useWorkouts'
import { usePoops } from '../hooks/usePoops'
import WorkoutTracker from './WorkoutTracker'
import PoopTracker from './PoopTracker'
import SharedSkincareView from './SharedSkincareView'

// Read-only view of a friend's shared Skincare/Workouts/Poop data, reached
// by tapping View next to them in the Friends panel. No code lookup here —
// by the time this renders we already have their uid from the friends
// list, and Firestore's rules are the real enforcement (isFriend()); if the
// friendship gets removed mid-view, the underlying reads just stop
// returning anything rather than throwing a dedicated error state.
export default function SharedProfileView({ uid, label, onExit }) {
  const [viewMode, setViewMode] = useState('skincare')
  const { workouts } = useWorkouts(uid)
  const { poops } = usePoops(uid)

  return (
    <div className="shared-profile">
      <div className="shared-profile-header">
        <span className="shared-profile-title">👀 Viewing {label || uid}</span>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onExit}>
          Exit
        </button>
      </div>

      <div className="mode-switch" role="tablist" aria-label="Shared data">
        <button
          role="tab"
          aria-selected={viewMode === 'skincare'}
          className={`mode-switch-btn${viewMode === 'skincare' ? ' mode-switch-btn--active' : ''}`}
          onClick={() => setViewMode('skincare')}
        >
          <span className="mode-switch-icon">🧴</span>
          <span className="mode-switch-label">Skincare</span>
        </button>
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

      {viewMode === 'skincare' ? (
        <SharedSkincareView uid={uid} />
      ) : viewMode === 'workout' ? (
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
    </div>
  )
}
