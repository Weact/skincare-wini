import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { TRACKERS } from '../constants'
import { useWorkouts } from '../hooks/useWorkouts'
import { usePoops } from '../hooks/usePoops'
import { useSteps } from '../hooks/useSteps'
import { useTasks } from '../hooks/useTasks'
import { useTaskCategories } from '../hooks/useTaskCategories'
import { useTaskLabels } from '../hooks/useTaskLabels'
import WorkoutTracker from './WorkoutTracker'
import PoopTracker from './PoopTracker'
import TasksTracker from './TasksTracker'
import SharedSkincareView from './SharedSkincareView'

const noop = () => {}

// Read-only view of a friend's shared trackers, reached by tapping View
// next to them in the Friends panel. No code lookup here — by the time
// this renders we already have their uid from the friends list, and
// Firestore's rules are the real enforcement (isFriend() + per-tracker
// trackerVisible()); if the friendship gets removed mid-view, the
// underlying reads just stop returning anything rather than throwing a
// dedicated error state.
export default function SharedProfileView({ uid, label, onExit }) {
  const [viewMode, setViewMode] = useState('skincare')
  const [ownerProfile, setOwnerProfile] = useState(null)
  const { workouts } = useWorkouts(uid)
  const { poops } = usePoops(uid)
  const { steps } = useSteps(uid)
  const { tasks } = useTasks(uid)
  const { taskCategories } = useTaskCategories(uid)
  const { taskLabels } = useTaskLabels(uid)

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      setOwnerProfile(snap.exists() ? snap.data() : {})
    }, err => console.error('Friend profile error:', err))
    return unsub
  }, [uid])

  // Missing field or missing key both default to visible, matching
  // trackerVisible() in firestore.rules — keeps this in sync with the
  // actual enforcement instead of guessing a different default here.
  const trackerVisibility = ownerProfile?.trackerVisibility || {}
  const visibleTrackers = TRACKERS.filter(t => trackerVisibility[t.key] !== false)
  const activeMode = visibleTrackers.some(t => t.key === viewMode) ? viewMode : visibleTrackers[0]?.key

  // Every tracker in TRACKERS gets an explicit branch here — a fallthrough
  // `else` would silently render the wrong tracker's data the next time one
  // is added to that list.
  function renderTracker() {
    switch (activeMode) {
      case 'skincare':
        return <SharedSkincareView uid={uid} />
      case 'workout':
        return (
          <WorkoutTracker
            workouts={workouts}
            steps={steps}
            logSteps={noop}
            addWorkout={noop}
            updateWorkout={noop}
            deleteWorkout={noop}
            readOnly
          />
        )
      case 'tasks':
        return (
          <TasksTracker
            tasks={tasks}
            taskCategories={taskCategories}
            taskLabels={taskLabels}
            addTask={noop}
            updateTask={noop}
            toggleTaskDone={noop}
            deleteTask={noop}
            deleteTasks={noop}
            reorderTasks={noop}
            addTaskCategory={noop}
            addTaskLabel={noop}
            updateTaskLabel={noop}
            deleteTaskLabel={noop}
            readOnly
          />
        )
      case 'poop':
        return (
          <PoopTracker
            poops={poops}
            addPoop={noop}
            deletePoop={noop}
            reorderPoops={noop}
            readOnly
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="shared-profile">
      <div className="shared-profile-header">
        <span className="shared-profile-title">👀 Viewing {label || uid}</span>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onExit}>
          Exit
        </button>
      </div>

      {visibleTrackers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <p className="empty-title">Nothing shared yet</p>
          <p className="empty-text">{label || 'This friend'} hasn't made any trackers visible to friends.</p>
        </div>
      ) : (
        <>
          <div className="mode-switch" role="tablist" aria-label="Shared data">
            {visibleTrackers.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeMode === t.key}
                className={`mode-switch-btn${activeMode === t.key ? ' mode-switch-btn--active' : ''}`}
                onClick={() => setViewMode(t.key)}
              >
                <span className="mode-switch-icon">{t.icon}</span>
                <span className="mode-switch-label">{t.label}</span>
              </button>
            ))}
          </div>

          {renderTracker()}
        </>
      )}
    </div>
  )
}
