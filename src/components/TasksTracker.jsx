import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  todayISO,
  toISODate,
  getWeekRange,
  monthKeyOf,
  formatMonthKey,
  formatDayHeading,
  formatOverdue,
} from '../utils/dateUtils'
import TaskRow from './TaskRow'
import TaskForm from './TaskForm'
import SelectionBar from './SelectionBar'
import DeleteConfirmModal from './DeleteConfirmModal'

const UNDATED = '__undated'

// Tasks sharing a date form one reorderable bucket; `order` is only ever
// compared inside a bucket (see useTasks), so this is the key everything
// drag-related is scoped by.
function bucketOf(task) {
  return task.date || UNDATED
}

// Wraps a row so it can be dragged within its day. Only mounted when
// dragging is actually possible (not read-only, not in select mode) —
// otherwise the handle would show with nothing behind it.
function SortableTaskRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <TaskRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function readStoredSplit() {
  const raw = parseFloat(localStorage.getItem('tasksSplit'))
  return Number.isFinite(raw) && raw >= 20 && raw <= 80 ? raw : 50
}

function readStoredCollapsed() {
  const raw = localStorage.getItem('tasksCollapsed')
  return raw === 'today' || raw === 'week' ? raw : null
}

export default function TasksTracker({
  tasks,
  taskCategories,
  taskLabels,
  addTask,
  updateTask,
  toggleTaskDone,
  deleteTask,
  deleteTasks,
  reorderTasks,
  addTaskCategory,
  addTaskLabel,
  updateTaskLabel,
  deleteTaskLabel,
  onAdded,
  readOnly = false,
}) {
  const today = todayISO()
  const { end: weekEnd } = getWeekRange(today)

  // Which section's add form is open, and what date it seeds — every
  // section has its own "+" so a task (and, through the form, a new
  // category or label) can be created from wherever you already are.
  const [adding, setAdding] = useState(null)   // { key, date, context } | null
  const [editingId, setEditingId] = useState(null)
  const formSlotRef = useRef(null)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [collapsedMonths, setCollapsedMonths] = useState(() => new Set())

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Split-pane geometry. Both persisted so the layout you set survives a
  // reload — collapsing a side is just a pinned extreme of the same control.
  const [split, setSplit] = useState(readStoredSplit)
  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  const [dragging, setDragging] = useState(false)
  const splitRef = useRef(null)

  // Predicted drag order, set synchronously on drop and cleared once
  // Firestore confirms it — without this the dropped row snaps back to its
  // old slot until the write round-trips (same pattern as products/poops).
  const [liveOrder, setLiveOrder] = useState(null)  // { bucket, ids }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  useEffect(() => { localStorage.setItem('tasksSplit', String(split)) }, [split])

  useEffect(() => {
    if (collapsed) localStorage.setItem('tasksCollapsed', collapsed)
    else localStorage.removeItem('tasksCollapsed')
  }, [collapsed])

  useEffect(() => {
    if (!liveOrder) return
    const confirmed = tasks
      .filter(t => bucketOf(t) === liveOrder.bucket)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(t => t.id)
    const matches = confirmed.length === liveOrder.ids.length &&
      confirmed.every((id, i) => id === liveOrder.ids[i])
    if (matches) setLiveOrder(null)
  }, [tasks])

  const catById = new Map(taskCategories.map(c => [c.id, c]))
  const labelById = new Map(taskLabels.map(l => [l.id, l]))

  function sortBucket(list, bucket) {
    if (liveOrder && liveOrder.bucket === bucket) {
      const predicted = liveOrder.ids.map(id => list.find(t => t.id === id)).filter(Boolean)
      // Anything added since the drag (or filtered out of it) still has to
      // appear, so append whatever the prediction doesn't already cover
      const seen = new Set(predicted.map(t => t.id))
      return [...predicted, ...list.filter(t => !seen.has(t.id))]
    }
    return [...list].sort((a, b) => {
      const ao = a.order ?? Infinity
      const bo = b.order ?? Infinity
      return ao !== bo ? ao - bo : String(a.createdAt).localeCompare(String(b.createdAt))
    })
  }

  // Date is always the outer ordering — categories and labels never pull a
  // task out of its day, they only ride along as chips on the row.
  function groupByDay(list) {
    const map = new Map()
    list.forEach(t => {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date).push(t)
    })
    return [...map.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map(date => ({ date, items: sortBucket(map.get(date), date) }))
  }

  function groupByMonth(list) {
    const map = new Map()
    list.forEach(t => {
      const k = monthKeyOf(t.date)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(t)
    })
    return [...map.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map(key => ({ key, days: groupByDay(map.get(key)) }))
  }

  const dated = tasks.filter(t => t.date)
  const todayTasks = dated.filter(t => t.date <= today)          // includes overdue
  const weekTasks = dated.filter(t => t.date > today && t.date <= weekEnd)
  const futureTasks = dated.filter(t => t.date > weekEnd)
  const undatedTasks = tasks.filter(t => !t.date)

  const todayGroups = groupByDay(todayTasks)
  const weekGroups = groupByDay(weekTasks)
  const monthGroups = groupByMonth(futureTasks)
  const undatedItems = sortBucket(undatedTasks, UNDATED)

  const openCount = list => list.filter(t => !t.done).length

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleMonth(key) {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedIds(new Set())
    setAdding(null)
    setEditingId(null)
  }

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmBulkDelete() {
    await deleteTasks([...selectedIds])
    setSelectedIds(new Set())
    setSelectMode(false)
    setShowDeleteConfirm(false)
  }

  const selectedItems = tasks
    .filter(t => selectedIds.has(t.id))
    .map(t => ({
      id: t.id,
      label: t.title,
      sublabel: t.date ? formatDayHeading(t.date) : 'Undated',
    }))

  async function handleAdd(values) {
    await addTask(values)
    setAdding(null)
    onAdded?.()
  }

  async function handleEdit(values) {
    await updateTask(editingId, values)
    setEditingId(null)
  }

  function openAdd(key, date, context) {
    setEditingId(null)
    setAdding(prev => (prev?.key === key ? null : { key, date, context }))
  }

  // The form lives at the top of the tracker, so a "+" tapped down in
  // Undated would otherwise open it somewhere off-screen
  useEffect(() => {
    if (!adding && !editingId) return
    formSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [adding?.key, editingId])

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const activeTask = tasks.find(t => t.id === active.id)
    const overTask = tasks.find(t => t.id === over.id)
    if (!activeTask || !overTask) return
    const bucket = bucketOf(activeTask)
    // Dragging between days would silently change a task's date — the date
    // field is the one place that should do that, so cross-bucket drops are
    // ignored rather than guessed at.
    if (bucket !== bucketOf(overTask)) return

    const current = sortBucket(tasks.filter(t => bucketOf(t) === bucket), bucket)
    const from = current.findIndex(t => t.id === active.id)
    const to = current.findIndex(t => t.id === over.id)
    if (from === -1 || to === -1) return
    const reordered = arrayMove(current, from, to)
    setLiveOrder({ bucket, ids: reordered.map(t => t.id) })
    reorderTasks(reordered)
  }

  const canDrag = !readOnly && !selectMode

  function renderTask(task, overdue = false) {
    const rowProps = {
      task,
      category: task.categoryId ? catById.get(task.categoryId) : null,
      labels: (task.labelIds || []).map(id => labelById.get(id)).filter(Boolean),
      expanded: expandedIds.has(task.id),
      onToggleExpand: toggleExpanded,
      onToggleDone: toggleTaskDone,
      onEdit: t => { setAdding(null); setEditingId(t.id) },
      onDelete: deleteTask,
      selectMode,
      selected: selectedIds.has(task.id),
      onToggleSelect: toggleSelected,
      readOnly,
      overdue,
      // The form sits at the top of the tracker, so the row it belongs to
      // has to say so or you lose track of what you're editing
      editing: editingId === task.id,
    }
    return canDrag
      ? <SortableTaskRow key={task.id} {...rowProps} />
      : <TaskRow key={task.id} {...rowProps} />
  }

  // One day's worth of rows, wrapped in its own SortableContext so ordering
  // stays scoped to that day
  function renderDay({ date, items }, { showHeading = true, headingLabel = null } = {}) {
    const overdue = date < today
    return (
      <div key={date} className="task-day">
        {showHeading && (
          <div className={`task-day-heading${overdue ? ' task-day-heading--overdue' : ''}`}>
            <span className="task-day-name">{headingLabel || formatDayHeading(date)}</span>
            {overdue && <span className="task-day-late">{formatOverdue(date)}</span>}
          </div>
        )}
        <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="task-day-list">
            {items.map(t => renderTask(t, overdue))}
          </div>
        </SortableContext>
      </div>
    )
  }

  // The one and only form slot, full tracker width, directly under the add
  // bar. It deliberately does NOT render inside whichever section's "+" was
  // tapped: a pane dragged down to a third of the screen can't fit a date
  // field, chip rows and an emoji picker, and .task-pane's overflow:hidden
  // (which rounds its corners) would clip the picker popup anyway.
  function renderFormSlot() {
    const editing = editingId ? tasks.find(t => t.id === editingId) : null
    if (!editing && !adding) return null
    const shared = {
      categories: taskCategories,
      labels: taskLabels,
      onAddCategory: addTaskCategory,
      onAddLabel: addTaskLabel,
      onUpdateLabel: updateTaskLabel,
      onDeleteLabel: deleteTaskLabel,
    }
    return (
      <div className="task-form-slot" ref={formSlotRef}>
        {editing ? (
          <TaskForm
            key={editing.id}
            initial={editing}
            heading="Editing task"
            {...shared}
            onSubmit={handleEdit}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <TaskForm
            key={adding.key}
            defaultDate={adding.date}
            heading={`New task in ${adding.context}`}
            {...shared}
            onSubmit={handleAdd}
            onCancel={() => setAdding(null)}
          />
        )}
      </div>
    )
  }

  // `context` is the section's own name — there are four of these buttons on
  // screen at once, so a bare "Add a task" would leave them indistinguishable
  function addButton(key, date, context) {
    if (readOnly || selectMode) return null
    return (
      <button
        type="button"
        className={`task-add-btn${adding?.key === key ? ' task-add-btn--open' : ''}`}
        onClick={() => openAdd(key, date, context)}
        aria-label={`Add a task to ${context}`}
      >
        <span className="task-add-plus">+</span>
      </button>
    )
  }

  // ── Split-pane divider ──────────────────────────────────────────────
  // Pointer events (not mouse+touch) so one code path drives finger and
  // cursor alike, with touch-action:none on the handle so a drag on the
  // divider never doubles as a page scroll.
  function onDividerDown(e) {
    if (collapsed) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  function onDividerMove(e) {
    if (!dragging || !splitRef.current) return
    const rect = splitRef.current.getBoundingClientRect()
    if (rect.width === 0) return
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setSplit(Math.min(80, Math.max(20, pct)))
  }

  function onDividerUp(e) {
    if (!dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function onDividerKeyDown(e) {
    if (collapsed) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); setSplit(s => Math.max(20, s - 5)) }
    if (e.key === 'ArrowRight') { e.preventDefault(); setSplit(s => Math.min(80, s + 5)) }
  }

  // Two columns when a side is collapsed, three when it isn't — the divider
  // is only rendered while both panes are open, so a fixed 3-column template
  // would drop the surviving pane into the wrong (zero-width) track.
  const gridTemplate = collapsed === 'today'
    ? '2.4rem 1fr'
    : collapsed === 'week'
    ? '1fr 2.4rem'
    : `${split}% 0.55rem 1fr`

  function rail(label, count) {
    return (
      <button
        type="button"
        className="task-rail"
        onClick={() => setCollapsed(null)}
        aria-label={`Expand ${label}`}
      >
        <span className="task-rail-text">{label}</span>
        {count > 0 && <span className="task-rail-count">{count}</span>}
      </button>
    )
  }

  function paneHeader(title, count, key, date, collapseKey) {
    return (
      <div className="task-pane-header">
        <span className="task-pane-title">{title}</span>
        {count > 0 && <span className="task-pane-count">{count}</span>}
        <span className="task-pane-spacer" />
        {addButton(key, date, title)}
        <button
          type="button"
          className="task-collapse-btn"
          onClick={() => setCollapsed(collapseKey)}
          aria-label={`Collapse ${title}`}
        >
          {collapseKey === 'today' ? '‹' : '›'}
        </button>
      </div>
    )
  }

  const totalOpen = openCount(tasks)
  const isEmpty = tasks.length === 0

  // Seed dates for each section's own "+": tomorrow for This week (today
  // already has its own pane), and the first day past this week for Future.
  // toISODate, not toISOString — the latter shifts to UTC and lands on the
  // wrong day for any timezone east of it.
  const tomorrow = new Date(today + 'T00:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = toISODate(tomorrow)
  const afterWeek = new Date(weekEnd + 'T00:00:00')
  afterWeek.setDate(afterWeek.getDate() + 1)
  const afterWeekISO = toISODate(afterWeek)

  return (
    <div className="tasks-tracker">
      {!readOnly && (
        <>
          <div className="tasks-add-bar">
            <button
              type="button"
              className="tasks-add-main"
              onClick={() => openAdd('top', today, 'Today')}
              disabled={selectMode}
            >
              <span className="task-add-plus">+</span> Add task
            </button>
            <SelectionBar
              selectMode={selectMode}
              count={selectedIds.size}
              onToggle={toggleSelectMode}
              onDeleteClick={() => setShowDeleteConfirm(true)}
            />
          </div>
          {renderFormSlot()}
        </>
      )}

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p className="empty-title">No tasks yet</p>
          <p className="empty-text">
            {readOnly
              ? 'Nothing on the list.'
              : 'Add your first task above — give it a date to slot it into Today, This week, or Future, or leave it undated.'}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* ── Today | This week ── */}
          <div className="tasks-split" ref={splitRef} style={{ gridTemplateColumns: gridTemplate }}>
            {collapsed === 'today' ? (
              rail('Today', openCount(todayTasks))
            ) : (
              <section className="task-pane">
                {paneHeader('Today', openCount(todayTasks), 'today', today, 'today')}
                <div className="task-pane-body">
                  {todayGroups.length === 0 ? (
                    <p className="task-pane-empty">Nothing due today.</p>
                  ) : (
                    // A heading per day only earns its space once overdue
                    // tasks have pulled a second day into this pane
                    todayGroups.map(g => renderDay(g, {
                      showHeading: todayGroups.length > 1,
                      headingLabel: g.date === today ? 'Today' : null,
                    }))
                  )}
                </div>
              </section>
            )}

            {!collapsed && (
              <div
                className={`task-divider${dragging ? ' task-divider--dragging' : ''}`}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize Today and This week"
                tabIndex={0}
                onPointerDown={onDividerDown}
                onPointerMove={onDividerMove}
                onPointerUp={onDividerUp}
                onPointerCancel={onDividerUp}
                onKeyDown={onDividerKeyDown}
              >
                <span className="task-divider-grip" />
              </div>
            )}

            {collapsed === 'week' ? (
              rail('This week', openCount(weekTasks))
            ) : (
              <section className="task-pane">
                {paneHeader('This week', openCount(weekTasks), 'week', tomorrowISO, 'week')}
                <div className="task-pane-body">
                  {weekGroups.length === 0 ? (
                    <p className="task-pane-empty">Nothing left this week.</p>
                  ) : (
                    weekGroups.map(g => renderDay(g))
                  )}
                </div>
              </section>
            )}
          </div>

          {/* ── Future ── */}
          <section className="task-section">
            <div className="task-section-header">
              <span className="task-section-title">Future</span>
              {openCount(futureTasks) > 0 && (
                <span className="task-pane-count">{openCount(futureTasks)}</span>
              )}
              <span className="task-pane-spacer" />
              {addButton('future', afterWeekISO, 'Future')}
            </div>
            {monthGroups.length === 0 ? (
              <p className="task-pane-empty">Nothing scheduled beyond this week.</p>
            ) : (
              monthGroups.map(({ key, days }) => {
                const monthOpen = days.reduce((n, d) => n + openCount(d.items), 0)
                const isCollapsed = collapsedMonths.has(key)
                return (
                  <div key={key} className="task-month">
                    <button
                      type="button"
                      className="task-month-header"
                      onClick={() => toggleMonth(key)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className={`task-month-caret${isCollapsed ? '' : ' task-month-caret--open'}`}>›</span>
                      <span className="task-month-name">{formatMonthKey(key)}</span>
                      {monthOpen > 0 && <span className="task-pane-count">{monthOpen}</span>}
                    </button>
                    {!isCollapsed && (
                      <div className="task-month-body">
                        {days.map(g => renderDay(g))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>

          {/* ── Undated ── */}
          <section className="task-section">
            <div className="task-section-header">
              <span className="task-section-title">Undated</span>
              {openCount(undatedTasks) > 0 && (
                <span className="task-pane-count">{openCount(undatedTasks)}</span>
              )}
              <span className="task-pane-spacer" />
              {addButton('undated', null, 'Undated')}
            </div>
            {undatedItems.length === 0 ? (
              <p className="task-pane-empty">Everything has a date.</p>
            ) : (
              <SortableContext items={undatedItems.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="task-day-list">
                  {undatedItems.map(t => renderTask(t))}
                </div>
              </SortableContext>
            )}
          </section>
        </DndContext>
      )}

      {!isEmpty && !readOnly && (
        <p className="task-footer-count">
          {totalOpen === 0 ? 'All done 🎉' : `${totalOpen} open of ${tasks.length}`}
        </p>
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          items={selectedItems}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
