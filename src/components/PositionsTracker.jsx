import { useState, useRef, useEffect } from 'react'
import { POSITIONS } from '../constants'
import { formatDisplayDate } from '../utils/dateUtils'
import SelectionBar from './SelectionBar'
import DeleteConfirmModal from './DeleteConfirmModal'

// A single scratch-off cover. Draws an opaque "?" cover into a canvas and
// erases it (destination-out) as the user drags a pointer across it — mouse
// and touch both go through the Pointer Events API, so there's no need for
// separate mouse/touch handling like the drag-and-drop code elsewhere uses.
// Once enough of the cover is cleared it calls onRevealed and unmounts (the
// parent switches to the plain revealed card), so there's never more than a
// handful of these canvases alive at once.
// Below this many pixels of movement, a touch gesture's direction is still
// ambiguous — wait for more before committing it to either scroll or scratch.
const TOUCH_LOCK_THRESHOLD = 6

function ScratchCover({ onRevealed }) {
  const canvasRef = useRef(null)
  const scratchingRef = useRef(false)
  const revealedRef = useRef(false)
  const checkScheduledRef = useRef(false)
  const scratchCountRef = useRef(0)
  // Per-touch-gesture direction lock: 'pending' (undecided) → 'scroll' (a
  // vertical swipe — hands off to the browser, never scratches) or 'scratch'
  // (mostly horizontal/diagonal — scratches for the rest of this gesture).
  // Without this, touch-action: pan-y still delivers pointermove events to
  // the canvas *while* the browser is also scrolling the page, so a plain
  // upward swipe to scroll was also drawing a scratch mark. Mouse/pen never
  // need this — there's no competing scroll gesture to disambiguate from.
  const touchGestureRef = useRef('pending')
  const touchStartRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    canvas.width = rect.width
    canvas.height = rect.height
    // Canvas colour APIs can't resolve CSS var() references the way DOM
    // styles can — addColorStop() throws a SyntaxError on an unparsable
    // string, which (with no error boundary in the app) took down the whole
    // React tree. Resolve the custom properties to real colour values first.
    const rootStyles = getComputedStyle(document.documentElement)
    const start = rootStyles.getPropertyValue('--scratch-cover-start').trim() || '#b0577a'
    const end = rootStyles.getPropertyValue('--scratch-cover-end').trim() || '#6a4a9c'
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height)
    gradient.addColorStop(0, start)
    gradient.addColorStop(1, end)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `${Math.round(rect.height * 0.32)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', rect.width / 2, rect.height / 2)
  }, [])

  function scratchAt(clientX, clientY) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(clientX - rect.left, clientY - rect.top, rect.width * 0.16, 0, Math.PI * 2)
    ctx.fill()
    scratchCountRef.current++
  }

  // Reveals once EITHER condition is met: 35% of the cover cleared (the
  // "actually scratched most of it off" case), or 130 dabs landed regardless
  // of how much area they cleared (someone scratching the same tiny corner
  // over and over could otherwise never cross 35% — this guarantees the
  // card gives up eventually either way).
  function checkRevealed() {
    if (revealedRef.current) return
    if (scratchCountRef.current >= 130) {
      revealedRef.current = true
      onRevealed()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    if (!width || !height) return
    const step = 4
    const data = ctx.getImageData(0, 0, width, height).data
    let cleared = 0
    let total = 0
    for (let i = 3; i < data.length; i += 4 * step) {
      total++
      if (data[i] === 0) cleared++
    }
    if (total > 0 && cleared / total > 0.35) {
      revealedRef.current = true
      onRevealed()
    }
  }

  // checkRevealed reads the canvas back with getImageData, which is too
  // costly to run on every single pointermove — rAF-throttling it still
  // reveals mid-drag (at most one frame after crossing the threshold)
  // instead of making the user lift their finger/mouse first.
  function scheduleCheck() {
    if (checkScheduledRef.current) return
    checkScheduledRef.current = true
    requestAnimationFrame(() => {
      checkScheduledRef.current = false
      checkRevealed()
    })
  }

  function handlePointerDown(e) {
    if (e.pointerType === 'touch') {
      // Direction still unknown — don't scratch or capture yet, wait for
      // handlePointerMove to see which way this gesture actually goes.
      touchGestureRef.current = 'pending'
      touchStartRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    scratchingRef.current = true
    scratchAt(e.clientX, e.clientY)
    checkRevealed()
  }

  function handlePointerMove(e) {
    if (e.pointerType === 'touch') {
      if (touchGestureRef.current === 'scroll') return
      const dx = e.clientX - touchStartRef.current.x
      const dy = e.clientY - touchStartRef.current.y
      if (touchGestureRef.current === 'pending') {
        if (Math.abs(dx) < TOUCH_LOCK_THRESHOLD && Math.abs(dy) < TOUCH_LOCK_THRESHOLD) return
        if (Math.abs(dy) > Math.abs(dx)) {
          // Predominantly vertical — this is a scroll, hand it entirely
          // back to the browser and never touch the canvas again this
          // gesture (touch-action: pan-y lets the scroll proceed natively).
          touchGestureRef.current = 'scroll'
          return
        }
        touchGestureRef.current = 'scratch'
        e.currentTarget.setPointerCapture?.(e.pointerId)
        scratchingRef.current = true
      }
      scratchAt(e.clientX, e.clientY)
      scheduleCheck()
      return
    }
    if (!scratchingRef.current) return
    scratchAt(e.clientX, e.clientY)
    scheduleCheck()
  }

  function handlePointerUp(e) {
    if (e.pointerType === 'touch' && touchGestureRef.current === 'pending') {
      // Lifted before the direction ever resolved — a plain tap, which
      // counts as one dab rather than being silently dropped.
      scratchAt(e.clientX, e.clientY)
      checkRevealed()
      return
    }
    if (scratchingRef.current) checkRevealed()
    scratchingRef.current = false
    touchGestureRef.current = 'pending'
  }

  function handlePointerCancel() {
    // The browser took the gesture over natively (e.g. committed it to
    // scrolling) — just reset, no scratch credit for an interrupted touch.
    scratchingRef.current = false
    touchGestureRef.current = 'pending'
  }

  return (
    <canvas
      ref={canvasRef}
      className="scratch-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  )
}

function PositionCard({ position, state, highlighted, cardRef, onRevealed, onToggleDone, selectMode, selected, onToggleSelect }) {
  const scratched = !!state?.scratched

  return (
    <div
      ref={cardRef}
      className={`position-card${scratched ? ' position-card--revealed' : ''}${highlighted ? ' position-card--highlighted' : ''}`}
    >
      {!scratched ? (
        // Nothing to select on an unrevealed card — scratching stays off
        // while Select mode is on so the two interactions can't collide.
        <div className={`scratch-cover-wrap${selectMode ? ' scratch-cover-wrap--disabled' : ''}`}>
          {!selectMode && <ScratchCover onRevealed={onRevealed} />}
        </div>
      ) : (
        <button
          type="button"
          className={`position-card-body${state?.done ? ' position-card-body--done' : ''}${selectMode && selected ? ' position-card-body--selected' : ''}`}
          onClick={selectMode ? onToggleSelect : onToggleDone}
        >
          {selectMode && (
            <input
              type="checkbox"
              className="card-select-checkbox position-select-checkbox"
              checked={selected}
              onChange={onToggleSelect}
              onClick={e => e.stopPropagation()}
            />
          )}
          <span className="position-emoji">{position.emoji}</span>
          <span className="position-name">{position.name}</span>
          <span className="position-blurb">{position.blurb}</span>
          <span className="position-done-tag">
            {selectMode
              ? (selected ? 'Selected to hide' : 'Tap to select')
              : (state?.done ? `✓ Experienced${state.doneAt ? ` · ${formatDisplayDate(state.doneAt)}` : ''}` : 'Tap to mark experienced')}
          </span>
        </button>
      )}
    </div>
  )
}

// Grid of scratch-off cards. Not part of the friend-sharing system at all —
// this is a strictly local/owner-only tracker, opted into from Settings.
export default function PositionsTracker({ positionStates, onReveal, onToggleDone, onHide }) {
  const [highlightedId, setHighlightedId] = useState(null)
  const cardRefs = useRef({})

  // Same Select / bulk-action pattern used by every other tracker — pick
  // any revealed cards, then confirm to put them back under their cover.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  const revealedCount = POSITIONS.filter(p => positionStates[p.id]?.scratched).length
  const doneCount = POSITIONS.filter(p => positionStates[p.id]?.done).length

  function handleRevealRandom() {
    const unscratched = POSITIONS.filter(p => !positionStates[p.id]?.scratched)
    if (unscratched.length === 0) return
    const pick = unscratched[Math.floor(Math.random() * unscratched.length)]
    setHighlightedId(pick.id)
    cardRefs.current[pick.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleRevealed(id) {
    onReveal(id)
    setHighlightedId(prev => (prev === id ? null : prev))
  }

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedIds(new Set())
  }

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmHideSelected() {
    onHide([...selectedIds])
    setSelectedIds(new Set())
    setSelectMode(false)
    setShowHideConfirm(false)
  }

  const selectedItems = POSITIONS
    .filter(p => selectedIds.has(p.id))
    .map(p => ({ id: p.id, label: p.name, sublabel: positionStates[p.id]?.done ? 'Experienced' : undefined }))

  return (
    <div className="positions-tracker">
      <div className="positions-warning-banner">
        🔞 Explicit content — 18+ only
      </div>

      <div className="positions-summary-row">
        <span className="positions-summary-item">{revealedCount}/{POSITIONS.length} revealed</span>
        <span className="positions-summary-item">{doneCount} experienced</span>
      </div>

      <div className="positions-actions-row">
        {!selectMode && revealedCount < POSITIONS.length && (
          <button type="button" className="new-cat-btn positions-random-btn" onClick={handleRevealRandom}>
            🎲 Reveal random position
          </button>
        )}
        {revealedCount > 0 && (
          <SelectionBar
            selectMode={selectMode}
            count={selectedIds.size}
            onToggle={toggleSelectMode}
            onDeleteClick={() => setShowHideConfirm(true)}
            actionLabel="Hide"
          />
        )}
      </div>

      <div className="positions-grid">
        {POSITIONS.map(position => (
          <PositionCard
            key={position.id}
            position={position}
            state={positionStates[position.id]}
            highlighted={highlightedId === position.id}
            cardRef={el => { cardRefs.current[position.id] = el }}
            onRevealed={() => handleRevealed(position.id)}
            onToggleDone={() => onToggleDone(position.id)}
            selectMode={selectMode}
            selected={selectedIds.has(position.id)}
            onToggleSelect={() => toggleSelected(position.id)}
          />
        ))}
      </div>

      {showHideConfirm && (
        <DeleteConfirmModal
          items={selectedItems}
          verb="Hide"
          bodyText="This will put the following back under their cover, to reveal again later:"
          onConfirm={confirmHideSelected}
          onCancel={() => setShowHideConfirm(false)}
        />
      )}
    </div>
  )
}
