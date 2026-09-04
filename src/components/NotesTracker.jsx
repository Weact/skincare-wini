import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NoteCard from './NoteCard'
import NoteForm from './NoteForm'
import NoteTreePicker from './NoteTreePicker'
import EmojiPicker from './EmojiPicker'
import SelectionBar from './SelectionBar'
import DeleteConfirmModal from './DeleteConfirmModal'

// Drag ids are prefixed by tier so one handler can tell what was picked up
// and what it was dropped on, across three nesting levels plus the root.
const ROOT_ID = 'nroot'

// ── Placement ───────────────────────────────────────────────────────
// A note lives in exactly one container, resolved category-first: its
// category if that category still exists, else its project, else the root.
// A category lives in its project if that project still exists, else the
// root. Resolving (rather than trusting the stored ids) means a document
// left pointing at something deleted still shows up somewhere real instead
// of vanishing — the same "compute it, don't store it" rule the skincare
// tracker's virtual sections follow.
function resolveNote(note, catIds, projIds) {
  const categoryId = note.categoryId && catIds.has(note.categoryId) ? note.categoryId : null
  const projectId = categoryId
    ? null
    : (note.projectId && projIds.has(note.projectId) ? note.projectId : null)
  return { ...note, categoryId, projectId }
}

function resolveCategory(cat, projIds) {
  return { ...cat, projectId: cat.projectId && projIds.has(cat.projectId) ? cat.projectId : null }
}

// `order` is only ever compared inside one container, so these keys are what
// every drag, sort and confirmation check is scoped by.
function noteBucket(n) {
  return `${n.categoryId || ''}::${n.projectId || ''}`
}

function catBucket(c) {
  return c.projectId || ''
}

function sortByOrder(list) {
  return [...list].sort((a, b) => {
    const ao = a.order ?? Infinity
    const bo = b.order ?? Infinity
    return ao !== bo ? ao - bo : String(a.createdAt).localeCompare(String(b.createdAt))
  })
}

// Whether two lists resolve to the same on-screen order per container —
// how an optimistic drag prediction knows Firestore has caught up. Compares
// id sequences rather than raw `order` numbers, since different containers
// reuse the same numbers by design.
function sameOrder(a, b, bucketOf) {
  const groupBy = list => {
    const groups = {}
    list.forEach(item => {
      const k = bucketOf(item)
      ;(groups[k] ??= []).push(item)
    })
    Object.values(groups).forEach(arr =>
      arr.sort((x, y) => (x.order ?? Infinity) - (y.order ?? Infinity)))
    return groups
  }
  const ga = groupBy(a)
  const gb = groupBy(b)
  const keys = new Set([...Object.keys(ga), ...Object.keys(gb)])
  for (const k of keys) {
    const idsA = (ga[k] || []).map(i => i.id)
    const idsB = (gb[k] || []).map(i => i.id)
    if (idsA.length !== idsB.length) return false
    for (let i = 0; i < idsA.length; i++) {
      if (idsA[i] !== idsB[i]) return false
    }
  }
  return true
}

// A drag prediction can go stale in two ways while it waits for Firestore to
// confirm it: something in it gets deleted, or something new arrives. Neither
// should have to wait out the round-trip, so the prediction is reconciled
// against the real list on every render — it keeps its own order for the
// items it knows about, and anything it has never seen lands at the end.
function reconcile(live, real) {
  if (!live) return real
  const realIds = new Set(real.map(r => r.id))
  const liveIds = new Set(live.map(l => l.id))
  return [...live.filter(l => realIds.has(l.id)), ...real.filter(r => !liveIds.has(r.id))]
}

// With three nesting tiers (project > category > note), pure centre-distance
// matching gets unstable — a project's rect spans far more area than the
// note under the cursor. Same detection the skincare tracker settled on.
function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
}

// ── Sortable wrappers ───────────────────────────────────────────────

function SortableNote(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `note-${props.note.id}`,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <NoteCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// Both container tiers drag the same way, so one wrapper covers them. The
// whole section is the droppable — that's what lets an empty project or
// category be dropped into at all.
function SortableContainer({ id, className, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className}${isOver ? ` ${className}--over` : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// ── Section header ──────────────────────────────────────────────────
// Rename / delete state is local to each header (the same shape as the
// skincare CategorySection) so one open menu can't leak into another.
function SectionHeader({
  item,
  kind,               // 'project' | 'category'
  count,
  collapsed,
  onToggleCollapse,
  onRename,
  onDelete,
  onAddNote,
  onAddCategory,      // projects only
  addingNote,
  addingCategory,
  locationOptions,    // categories only — which project this one sits in
  currentLocation,
  dragHandleProps,
  readOnly,
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editLocation, setEditLocation] = useState('root')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef(null)
  const menuRef = useRef(null)
  const emojiRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  function startEdit() {
    setEditName(item.name)
    setEditEmoji(item.emoji || '')
    setEditLocation(currentLocation || 'root')
    setEditing(true)
    setShowMenu(false)
  }

  function saveEdit() {
    if (!editName.trim()) return
    onRename(item.id, { name: editName.trim(), emoji: editEmoji, location: editLocation })
    setEditing(false)
    setShowEmoji(false)
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      clearTimeout(confirmTimer.current)
      onDelete(item.id)
    } else {
      setConfirmDelete(true)
      setShowMenu(false)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const fallbackEmoji = kind === 'project' ? '📂' : '🗂️'

  if (editing) {
    return (
      <div className={`note-section-header note-section-header--${kind} note-section-header--editing`}>
        <div className="note-edit-form">
          <div className="note-edit-row" ref={emojiRef}>
            <div className="cat-emoji-wrap">
              <button type="button" className="cat-emoji-btn" onClick={() => setShowEmoji(s => !s)}>
                {editEmoji || fallbackEmoji}
              </button>
              {showEmoji && (
                <EmojiPicker value={editEmoji} onSelect={e => { setEditEmoji(e); setShowEmoji(false) }} />
              )}
            </div>
            <input
              className="cat-name-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
            />
          </div>

          {/* Only categories have somewhere to be moved to — a project is
              already the outermost tier, so it has no parent to pick */}
          {locationOptions?.length > 1 && (
            <div className="note-form-field">
              <label className="field-label">In</label>
              <NoteTreePicker
                options={locationOptions}
                value={editLocation}
                onChange={setEditLocation}
                label="Which project this category sits in"
              />
            </div>
          )}

          <div className="note-edit-actions">
            <button type="button" className="cat-save-btn" onClick={saveEdit}>Save</button>
            <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`note-section-header note-section-header--${kind}`}>
      {dragHandleProps && !readOnly && (
        <span className="cat-drag-handle" {...dragHandleProps}>
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

      <button type="button" className="note-section-main" onClick={onToggleCollapse}>
        <span className="note-section-emoji">{item.emoji || fallbackEmoji}</span>
        <span className="note-section-name">{item.name}</span>
        <span className="note-section-count">{count}</span>
        <span className={`chevron${collapsed ? '' : ' chevron--up'}`}>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {!readOnly && (
        <div className="note-section-actions">
          {/* Labelled rather than a bare "+": a project can take both a note
              and a category, and a single plus would leave you guessing. */}
          <button
            type="button"
            className={`note-mini-btn${addingNote ? ' note-mini-btn--open' : ''}`}
            onClick={onAddNote}
          >
            + Note
          </button>
          {onAddCategory && (
            <button
              type="button"
              className={`note-mini-btn${addingCategory ? ' note-mini-btn--open' : ''}`}
              onClick={onAddCategory}
            >
              + Category
            </button>
          )}
          <div className="cat-menu-wrap" ref={menuRef}>
            {confirmDelete ? (
              <button type="button" className="cat-confirm-delete-btn" onClick={handleDeleteClick}>
                Tap to confirm
              </button>
            ) : (
              <button type="button" className="cat-menu-btn" onClick={() => setShowMenu(s => !s)}>···</button>
            )}
            {showMenu && (
              <div className="cat-menu">
                <button type="button" onClick={startEdit}>Rename</button>
                <button type="button" className="cat-menu-danger" onClick={handleDeleteClick}>Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── New project / new category form ─────────────────────────────────
function ContainerForm({ heading, placeholder, fallbackEmoji, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const emojiRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handle(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, emoji)
  }

  return (
    <div className="note-container-form">
      <div className="note-form-heading">{heading}</div>
      <div className="note-container-row">
        <div className="cat-emoji-wrap" ref={emojiRef}>
          <button type="button" className="cat-emoji-btn" onClick={() => setShowEmoji(s => !s)}>
            {emoji || fallbackEmoji}
          </button>
          {showEmoji && (
            <EmojiPicker value={emoji} onSelect={e => { setEmoji(e); setShowEmoji(false) }} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="cat-name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') onCancel() }}
          placeholder={placeholder}
          maxLength={60}
        />
        <button type="button" className="cat-save-btn" onClick={save} disabled={!name.trim()}>Add</button>
        <button type="button" className="cat-cancel-btn" onClick={onCancel}>✕</button>
      </div>
    </div>
  )
}

// ── Tracker ─────────────────────────────────────────────────────────

export default function NotesTracker({
  notes,
  noteCategories,
  noteProjects,
  addNote,
  updateNote,
  deleteNote,
  deleteNotes,
  reorderNotes,
  moveNote,
  reassignNotes,
  addNoteCategory,
  updateNoteCategory,
  deleteNoteCategory,
  reorderNoteCategories,
  moveNoteCategory,
  reassignNoteCategories,
  addNoteProject,
  updateNoteProject,
  deleteNoteProject,
  reorderNoteProjects,
  onAdded,
  readOnly = false,
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  // Which slice of the tracker is on screen: everything, one project, one
  // category, or just the unfiled notes. Stored as a single string ('all',
  // 'unfiled', 'p:<id>', 'c:<id>') so it survives a reload the way the other
  // trackers remember their layout.
  const [scopeKey, setScopeKey] = useState(() => localStorage.getItem('notesScope') || 'all')
  const [editingId, setEditingId] = useState(null)
  // { key, projectId, categoryId, context } — which section's "+ Note" is open
  const [adding, setAdding] = useState(null)
  // null | { projectId } — which section's "+ Category" is open
  const [addingCat, setAddingCat] = useState(null)
  const [addingProject, setAddingProject] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Optimistic drag predictions, cleared once Firestore confirms the same
  // arrangement — without these a dropped item snaps back to its old slot
  // for a beat while the write round-trips.
  const [activeId, setActiveId] = useState(null)
  const [liveNotes, setLiveNotes] = useState(null)
  const [liveCategories, setLiveCategories] = useState(null)
  const [liveProjectOrder, setLiveProjectOrder] = useState(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const projIds = new Set(noteProjects.map(p => p.id))
  const catIds = new Set(noteCategories.map(c => c.id))

  const normNotes = list => list.map(n => resolveNote(n, catIds, projIds))
  const normCats = list => list.map(c => resolveCategory(c, projIds))

  useEffect(() => {
    if (!liveNotes) return
    if (sameOrder(normNotes(notes), liveNotes, noteBucket)) setLiveNotes(null)
  }, [notes])

  useEffect(() => {
    if (!liveCategories) return
    if (sameOrder(normCats(noteCategories), liveCategories, catBucket)) setLiveCategories(null)
  }, [noteCategories])

  useEffect(() => {
    if (!liveProjectOrder) return
    const confirmed = noteProjects.map(p => p.id)
    const matches = confirmed.length === liveProjectOrder.length &&
      confirmed.every((id, i) => id === liveProjectOrder[i])
    if (matches) setLiveProjectOrder(null)
  }, [noteProjects])

  // ── The tree ──────────────────────────────────────────────────────
  const displayNotes = normNotes(reconcile(liveNotes, notes))
  const displayCats = normCats(reconcile(liveCategories, noteCategories))
  const displayProjects = liveProjectOrder
    ? reconcile(liveProjectOrder.map(id => noteProjects.find(p => p.id === id)).filter(Boolean), noteProjects)
    : noteProjects

  const notesIn = (categoryId, projectId) => sortByOrder(displayNotes.filter(n =>
    (n.categoryId || null) === (categoryId || null) &&
    (n.projectId || null) === (projectId || null)))

  const catsIn = projectId => sortByOrder(displayCats.filter(c => (c.projectId || null) === (projectId || null)))

  // A project's badge counts everything under it, categories included — the
  // number is there to say how much is inside, not how much is loose.
  function projectNoteCount(projectId) {
    const own = displayNotes.filter(n => !n.categoryId && n.projectId === projectId).length
    const viaCats = catsIn(projectId).reduce((sum, c) => sum + notesIn(c.id, null).length, 0)
    return own + viaCats
  }

  const rootCats = catsIn(null)
  const rootNotes = notesIn(null, null)

  // ── Scope ─────────────────────────────────────────────────────────
  // Resolved against what actually exists, the same way a note's placement
  // is: scoping to a project and then deleting it falls back to showing
  // everything rather than leaving the tracker stuck on an empty screen.
  const scopedProject = scopeKey.startsWith('p:')
    ? displayProjects.find(p => p.id === scopeKey.slice(2))
    : null
  const scopedCategory = scopeKey.startsWith('c:')
    ? displayCats.find(c => c.id === scopeKey.slice(2))
    : null
  const scope = scopedProject
    ? 'project'
    : scopedCategory
    ? 'category'
    : scopeKey === 'unfiled'
    ? 'unfiled'
    : 'all'

  useEffect(() => {
    if (scopeKey === 'all') localStorage.removeItem('notesScope')
    else localStorage.setItem('notesScope', scopeKey)
  }, [scopeKey])

  // A scope pointing at something deleted is left in storage rather than
  // reset: the collections start empty on every load and only fill in when
  // Firestore's first snapshot lands, so resetting on "can't find it" would
  // throw away a perfectly good scope every time the app opens. Resolving it
  // to 'all' each render already covers the deleted case.

  // Where the top bar's own buttons put things while a scope is active — a
  // note added into Unfiled from a project view would vanish the instant it
  // was created, so the add bar follows whatever is on screen.
  const scopeAdd = scopedProject
    ? { key: `proj-${scopedProject.id}`, projectId: scopedProject.id, categoryId: null, context: scopedProject.name }
    : scopedCategory
    ? { key: `cat-${scopedCategory.id}`, projectId: null, categoryId: scopedCategory.id, context: scopedCategory.name }
    : { key: 'root', projectId: null, categoryId: null, context: 'Unfiled' }

  // Nothing to narrow down until there's at least one container
  const showScopePicker = noteProjects.length > 0 || noteCategories.length > 0

  // One flat list for the picker, in the same order as the tracker itself:
  // the two whole-tracker views, then every project, then every category —
  // a project's own categories under it, the project-less ones last.
  const scopeOptions = [
    { value: 'all', emoji: '🗒️', label: 'Everything', count: notes.length },
    { value: 'unfiled', emoji: '📄', label: 'Unfiled only', count: rootNotes.length },
    ...displayProjects.map(p => ({
      value: `p:${p.id}`,
      emoji: p.emoji || '📂',
      label: p.name,
      count: projectNoteCount(p.id),
      group: 'Projects',
    })),
    // The project name rides along as a separate prefix rather than being
    // baked into the label — two projects can hold a category of the same
    // name, and the prefix is what tells them apart
    ...displayProjects.flatMap(p => catsIn(p.id).map(c => ({
      value: `c:${c.id}`,
      emoji: c.emoji || '🗂️',
      label: c.name,
      prefix: `${p.name} › `,
      count: notesIn(c.id, null).length,
      group: 'Categories',
    }))),
    ...rootCats.map(c => ({
      value: `c:${c.id}`,
      emoji: c.emoji || '🗂️',
      label: c.name,
      count: notesIn(c.id, null).length,
      group: 'Categories',
    })),
  ]

  // ── Filing by hand ────────────────────────────────────────────────
  // The same tree, offered as destinations rather than as views. No counts:
  // where a note is going has nothing to do with how full that place is.
  const noteLocationOptions = [
    { value: 'root', emoji: '📄', label: 'Unfiled' },
    ...scopeOptions
      .filter(o => o.group)
      .map(({ count, ...rest }) => rest),
  ]

  // A category can only ever sit in a project or at the top level
  const categoryLocationOptions = [
    { value: 'root', emoji: '🗂️', label: 'No project' },
    ...displayProjects.map(p => ({
      value: `p:${p.id}`,
      emoji: p.emoji || '📂',
      label: p.name,
      group: 'Projects',
    })),
  ]

  const locationKeyOfNote = n =>
    n.categoryId ? `c:${n.categoryId}` : n.projectId ? `p:${n.projectId}` : 'root'

  // A note dropped into a category stores `projectId: null` — the category
  // is what says which project it's in (see resolveNote), so a location key
  // never sets both.
  function noteFieldsFromKey(key) {
    if (key.startsWith('c:')) return { categoryId: key.slice(2), projectId: null }
    if (key.startsWith('p:')) return { categoryId: null, projectId: key.slice(2) }
    return { categoryId: null, projectId: null }
  }

  // ── Selection ─────────────────────────────────────────────────────
  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Every add form renders inside its section's body, so a "+" tapped on a
  // collapsed section has to unfold it first — otherwise the form opens
  // somewhere nothing is drawn.
  function expandSection(id) {
    setCollapsedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleCollapsed(id) {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedIds(new Set())
    setAdding(null)
    setAddingCat(null)
    setAddingProject(false)
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
    await deleteNotes([...selectedIds])
    setSelectedIds(new Set())
    setSelectMode(false)
    setShowDeleteConfirm(false)
  }

  // Where a note lives, spelled out — the delete confirmation cuts across
  // every section, so the title alone isn't enough to tell two apart.
  function locationLabel(note) {
    const resolved = resolveNote(note, catIds, projIds)
    if (resolved.categoryId) {
      const cat = noteCategories.find(c => c.id === resolved.categoryId)
      const proj = cat?.projectId ? noteProjects.find(p => p.id === cat.projectId) : null
      return proj ? `${proj.name} › ${cat.name}` : cat?.name || 'Unfiled'
    }
    if (resolved.projectId) {
      return noteProjects.find(p => p.id === resolved.projectId)?.name || 'Unfiled'
    }
    return 'Unfiled'
  }

  const selectedItems = notes
    .filter(n => selectedIds.has(n.id))
    .map(n => ({ id: n.id, label: n.title || 'Untitled note', sublabel: locationLabel(n) }))

  // ── Create / edit / delete ────────────────────────────────────────
  function openAdd(key, projectId, categoryId, context) {
    setEditingId(null)
    setAddingCat(null)
    setAdding(prev => (prev?.key === key ? null : { key, projectId, categoryId, context }))
  }

  async function handleAddNote(values) {
    const { location, ...fields } = values
    await addNote({ ...fields, ...noteFieldsFromKey(location) })
    setAdding(null)
    onAdded?.()
  }

  // Editing can move a note as well as change its text. A move can't just
  // write the new ids: `order` is only meaningful inside one container, so
  // the note would land on top of whatever already holds that number. It
  // goes to the end of the destination instead, renumbering it in the same
  // batch that saves the edit. The container it left keeps its gaps —
  // ordering is relative, so a hole in the numbering changes nothing.
  async function handleEditNote(id, values) {
    const { location, ...fields } = values
    const current = displayNotes.find(n => n.id === id)
    const target = noteFieldsFromKey(location)
    const moved = current && (
      (current.categoryId || null) !== target.categoryId ||
      (current.projectId || null) !== target.projectId
    )
    if (moved) {
      const destination = [
        ...notesIn(target.categoryId, target.projectId).filter(n => n.id !== id),
        { ...current, ...target },
      ]
      await moveNote(id, { ...fields, ...target, updatedAt: new Date().toISOString() }, destination)
    } else {
      await updateNote(id, fields)
    }
    setEditingId(null)
  }

  function openAddCategory(projectId) {
    setAdding(null)
    setAddingCat(prev => (prev && prev.projectId === projectId ? null : { projectId }))
  }

  async function handleAddCategory(name, emoji) {
    await addNoteCategory(name, emoji, addingCat.projectId)
    setAddingCat(null)
  }

  // Renaming a category can also re-home it. Same reasoning as a note's
  // move: the destination project is renumbered so the category lands at
  // the end rather than colliding with a sibling's `order`. Every note
  // inside comes along untouched — they point at the category, not at the
  // project (see resolveNote).
  async function handleSaveCategory(id, { name, emoji, location }) {
    const current = displayCats.find(c => c.id === id)
    const toProject = location?.startsWith('p:') ? location.slice(2) : null
    if (current && (current.projectId || null) !== toProject) {
      const destination = [
        ...catsIn(toProject).filter(c => c.id !== id),
        { ...current, projectId: toProject },
      ]
      await moveNoteCategory(id, { name, emoji, projectId: toProject }, destination)
    } else {
      await updateNoteCategory(id, { name, emoji })
    }
  }

  // Projects are the outermost tier — there is nowhere to move one to, so
  // `location` never arrives here
  async function handleSaveProject(id, { name, emoji }) {
    await updateNoteProject(id, { name, emoji })
  }

  async function handleAddProject(name, emoji) {
    await addNoteProject(name, emoji)
    setAddingProject(false)
  }

  // Deleting a container never deletes what's inside it — the notes move up
  // one level (a category's notes into its project, a project's notes and
  // categories out to the root) and are renumbered onto the end of wherever
  // they land, so they can't collide with what's already there.
  async function handleDeleteCategory(catId) {
    const cat = noteCategories.find(c => c.id === catId)
    const parentProject = cat?.projectId && projIds.has(cat.projectId) ? cat.projectId : null
    const orphans = sortByOrder(displayNotes.filter(n => n.categoryId === catId))
    const destination = notesIn(null, parentProject)
    let next = destination.length ? Math.max(...destination.map(n => n.order ?? 0)) + 1 : 0
    await reassignNotes(orphans.map(n => ({
      id: n.id,
      categoryId: null,
      projectId: parentProject,
      order: next++,
    })))
    await deleteNoteCategory(catId)
  }

  async function handleDeleteProject(projectId) {
    const strandedCats = catsIn(projectId)
    const rootDestination = catsIn(null)
    let catNext = rootDestination.length ? Math.max(...rootDestination.map(c => c.order ?? 0)) + 1 : 0
    await reassignNoteCategories(strandedCats.map(c => ({
      id: c.id,
      projectId: null,
      order: catNext++,
    })))

    const strandedNotes = notesIn(null, projectId)
    const noteDestination = notesIn(null, null)
    let noteNext = noteDestination.length ? Math.max(...noteDestination.map(n => n.order ?? 0)) + 1 : 0
    await reassignNotes(strandedNotes.map(n => ({
      id: n.id,
      categoryId: null,
      projectId: null,
      order: noteNext++,
    })))

    await deleteNoteProject(projectId)
  }

  // ── Drag and drop ─────────────────────────────────────────────────
  // Reads a drop target id back into a container. Dropping onto a note
  // means "into whatever holds that note, just above it", which is what
  // makes a note droppable between two others rather than only into a
  // section's empty space.
  function targetFromOver(oId, list) {
    if (oId.startsWith('note-')) {
      const over = list.find(n => n.id === oId.slice(5))
      if (!over) return null
      return { categoryId: over.categoryId || null, projectId: over.projectId || null, before: over.id }
    }
    if (oId.startsWith('ncat-')) {
      const cat = displayCats.find(c => c.id === oId.slice(5))
      if (!cat) return null
      return { categoryId: cat.id, projectId: null, before: null }
    }
    if (oId.startsWith('nproj-')) {
      const proj = displayProjects.find(p => p.id === oId.slice(6))
      if (!proj) return null
      return { categoryId: null, projectId: proj.id, before: null }
    }
    if (oId === ROOT_ID) return { categoryId: null, projectId: null, before: null }
    return null
  }

  // The same reading, one tier up: a category can only ever land in a
  // project or at the root, so a note target collapses to its project.
  function categoryTargetFromOver(oId) {
    if (oId.startsWith('ncat-')) {
      const cat = displayCats.find(c => c.id === oId.slice(5))
      if (!cat) return null
      return { projectId: cat.projectId || null, before: cat.id }
    }
    if (oId.startsWith('nproj-')) {
      const proj = displayProjects.find(p => p.id === oId.slice(6))
      if (!proj) return null
      return { projectId: proj.id, before: null }
    }
    if (oId.startsWith('note-')) {
      const note = displayNotes.find(n => n.id === oId.slice(5))
      if (!note) return null
      const parentCat = note.categoryId ? displayCats.find(c => c.id === note.categoryId) : null
      return { projectId: parentCat ? (parentCat.projectId || null) : (note.projectId || null), before: null }
    }
    if (oId === ROOT_ID) return { projectId: null, before: null }
    return null
  }

  function handleDragStart({ active }) {
    setActiveId(String(active.id))
  }

  function handleDragOver({ active, over }) {
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)

    if (aId.startsWith('note-')) {
      const fromId = aId.slice(5)
      setLiveNotes(prev => {
        const current = normNotes(reconcile(prev, notes))
        const moving = current.find(n => n.id === fromId)
        if (!moving) return prev
        const target = targetFromOver(oId, current)
        if (!target || target.before === fromId) return prev

        const inBucket = n =>
          (n.categoryId || null) === target.categoryId && (n.projectId || null) === target.projectId
        const without = current.filter(n => n.id !== fromId)
        const destination = sortByOrder(without.filter(inBucket))
        const moved = { ...moving, categoryId: target.categoryId, projectId: target.projectId }
        const idx = target.before ? destination.findIndex(n => n.id === target.before) : -1
        destination.splice(idx === -1 ? destination.length : idx, 0, moved)
        const renumbered = destination.map((n, i) => ({ ...n, order: i }))
        return [...without.filter(n => !inBucket(n)), ...renumbered]
      })
      return
    }

    if (aId.startsWith('ncat-')) {
      const fromId = aId.slice(5)
      setLiveCategories(prev => {
        const current = normCats(reconcile(prev, noteCategories))
        const moving = current.find(c => c.id === fromId)
        if (!moving) return prev
        const target = categoryTargetFromOver(oId)
        if (!target || target.before === fromId) return prev

        const inBucket = c => (c.projectId || null) === target.projectId
        const without = current.filter(c => c.id !== fromId)
        const destination = sortByOrder(without.filter(inBucket))
        const moved = { ...moving, projectId: target.projectId }
        const idx = target.before ? destination.findIndex(c => c.id === target.before) : -1
        destination.splice(idx === -1 ? destination.length : idx, 0, moved)
        const renumbered = destination.map((c, i) => ({ ...c, order: i }))
        return [...without.filter(c => !inBucket(c)), ...renumbered]
      })
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    const aId = String(active.id)
    // Reconciled, not raw: every write below is a merge, so a note deleted
    // between picking one up and dropping it would be resurrected as a
    // doc holding nothing but an `order` if it were still in the prediction.
    const settledNotes = reconcile(liveNotes, notes)
    const settledCats = reconcile(liveCategories, noteCategories)

    // ── Projects: a flat reorder, so there's nothing to predict mid-drag ──
    if (aId.startsWith('nproj-')) {
      setLiveNotes(null)
      setLiveCategories(null)
      if (!over) return
      const oId = String(over.id)
      if (!oId.startsWith('nproj-') || oId === aId) return
      const from = noteProjects.findIndex(p => `nproj-${p.id}` === aId)
      const to = noteProjects.findIndex(p => `nproj-${p.id}` === oId)
      if (from === -1 || to === -1) return
      const reordered = arrayMove([...noteProjects], from, to)
      setLiveProjectOrder(reordered.map(p => p.id))
      reorderNoteProjects(reordered)
      return
    }

    // ── Categories ──
    if (aId.startsWith('ncat-')) {
      setLiveNotes(null)
      let persisted = false
      if (liveCategories && over) {
        const fromId = aId.slice(5)
        const original = normCats(noteCategories).find(c => c.id === fromId)
        const predicted = settledCats.find(c => c.id === fromId)
        if (original && predicted) {
          const toProject = predicted.projectId || null
          const fromProject = original.projectId || null
          const destination = sortByOrder(settledCats.filter(c => (c.projectId || null) === toProject))
          if (fromProject !== toProject) {
            moveNoteCategory(fromId, { projectId: toProject }, destination)
            const source = sortByOrder(settledCats.filter(c => (c.projectId || null) === fromProject))
            if (source.length > 0) reorderNoteCategories(source)
          } else {
            reorderNoteCategories(destination)
          }
          persisted = true
        }
      }
      if (!persisted) setLiveCategories(null)
      return
    }

    // ── Notes ──
    let persisted = false
    if (aId.startsWith('note-') && liveNotes && over) {
      const fromId = aId.slice(5)
      const original = normNotes(notes).find(n => n.id === fromId)
      const predicted = settledNotes.find(n => n.id === fromId)
      if (original && predicted) {
        const toCat = predicted.categoryId || null
        const toProj = predicted.projectId || null
        const fromCat = original.categoryId || null
        const fromProj = original.projectId || null
        const destination = sortByOrder(settledNotes.filter(n =>
          (n.categoryId || null) === toCat && (n.projectId || null) === toProj))

        if (fromCat !== toCat || fromProj !== toProj) {
          moveNote(fromId, { categoryId: toCat, projectId: toProj }, destination)
          const source = sortByOrder(settledNotes.filter(n =>
            (n.categoryId || null) === fromCat && (n.projectId || null) === fromProj))
          if (source.length > 0) reorderNotes(source)
        } else {
          reorderNotes(destination)
        }
        persisted = true
      }
    }
    // Only fall back to the unconfirmed data when nothing was written —
    // otherwise keep showing the prediction until Firestore catches up.
    if (!persisted) setLiveNotes(null)
  }

  // ── Rendering ─────────────────────────────────────────────────────
  const canDrag = !readOnly && !selectMode

  function renderNote(note) {
    const props = {
      note,
      expanded: expandedIds.has(note.id),
      onToggleExpand: toggleExpanded,
      editing: editingId === note.id,
      onStartEdit: id => { setAdding(null); setAddingCat(null); setEditingId(id) },
      onSubmitEdit: handleEditNote,
      onCancelEdit: () => setEditingId(null),
      onDelete: deleteNote,
      selectMode,
      selected: selectedIds.has(note.id),
      onToggleSelect: toggleSelected,
      readOnly,
      locationOptions: noteLocationOptions,
      currentLocation: locationKeyOfNote(note),
    }
    // An open editor must not also be draggable — the handle would fight
    // the textarea for the same pointer.
    return canDrag && editingId !== note.id
      ? <SortableNote key={note.id} {...props} />
      : <NoteCard key={note.id} {...props} />
  }

  // One container's notes, plus its own add form. `emptyText` doubles as the
  // drop target for an empty container — without something occupying the
  // space there'd be nothing to aim a note at.
  function renderNoteList(items, addKey, emptyText) {
    return (
      <>
        {adding?.key === addKey && (
          <NoteForm
            key={addKey}
            heading={`New note in ${adding.context}`}
            locationOptions={noteLocationOptions}
            // The section whose "+" was tapped only seeds the field — it can
            // still be pointed somewhere else before the note is created
            defaultLocation={
              adding.categoryId ? `c:${adding.categoryId}`
                : adding.projectId ? `p:${adding.projectId}`
                : 'root'
            }
            onSubmit={handleAddNote}
            onCancel={() => setAdding(null)}
          />
        )}
        <SortableContext items={items.map(n => `note-${n.id}`)} strategy={verticalListSortingStrategy}>
          <div className="note-list">
            {items.length === 0
              ? <p className="note-empty-drop">{emptyText}</p>
              : items.map(renderNote)}
          </div>
        </SortableContext>
      </>
    )
  }

  function renderCategory(cat) {
    const items = notesIn(cat.id, null)
    const collapsed = collapsedIds.has(cat.id)
    const addKey = `cat-${cat.id}`
    return (
      <SortableContainer key={cat.id} id={`ncat-${cat.id}`} className="note-category">
        {handle => (
          <>
            <SectionHeader
              item={cat}
              kind="category"
              count={items.length}
              collapsed={collapsed}
              onToggleCollapse={() => toggleCollapsed(cat.id)}
              onRename={handleSaveCategory}
              onDelete={handleDeleteCategory}
              onAddNote={() => { expandSection(cat.id); openAdd(addKey, null, cat.id, cat.name) }}
              addingNote={adding?.key === addKey}
              locationOptions={categoryLocationOptions}
              currentLocation={cat.projectId ? `p:${cat.projectId}` : 'root'}
              dragHandleProps={canDrag ? handle : null}
              readOnly={readOnly || selectMode}
            />
            {!collapsed && (
              <div className="note-category-body">
                {renderNoteList(items, addKey, readOnly ? 'No notes here.' : 'Empty — drop a note here.')}
              </div>
            )}
          </>
        )}
      </SortableContainer>
    )
  }

  function renderProject(project) {
    const cats = catsIn(project.id)
    const direct = notesIn(null, project.id)
    const collapsed = collapsedIds.has(project.id)
    const addKey = `proj-${project.id}`
    return (
      <SortableContainer key={project.id} id={`nproj-${project.id}`} className="note-project">
        {handle => (
          <>
            <SectionHeader
              item={project}
              kind="project"
              count={projectNoteCount(project.id)}
              collapsed={collapsed}
              onToggleCollapse={() => toggleCollapsed(project.id)}
              onRename={handleSaveProject}
              onDelete={handleDeleteProject}
              onAddNote={() => { expandSection(project.id); openAdd(addKey, project.id, null, project.name) }}
              onAddCategory={() => { expandSection(project.id); openAddCategory(project.id) }}
              addingNote={adding?.key === addKey}
              addingCategory={addingCat?.projectId === project.id}
              dragHandleProps={canDrag ? handle : null}
              readOnly={readOnly || selectMode}
            />
            {!collapsed && (
              <div className="note-project-body">
                {addingCat?.projectId === project.id && (
                  <ContainerForm
                    heading={`New category in ${project.name}`}
                    placeholder="Category name"
                    fallbackEmoji="🗂️"
                    onSave={handleAddCategory}
                    onCancel={() => setAddingCat(null)}
                  />
                )}
                <SortableContext
                  items={cats.map(c => `ncat-${c.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {cats.map(renderCategory)}
                </SortableContext>
                {renderNoteList(
                  direct,
                  addKey,
                  cats.length > 0
                    ? 'No loose notes — drop one here to keep it out of a category.'
                    : (readOnly ? 'Nothing in this project.' : 'Empty — drop a note or add a category.'),
                )}
              </div>
            )}
          </>
        )}
      </SortableContainer>
    )
  }

  // The root's own droppable, so a note can be dragged all the way out of
  // every project and category
  const { setNodeRef: setRootRef, isOver: rootIsOver } = useDroppable({ id: ROOT_ID })

  // The add forms live inside the sections below, so an open one has to
  // push the empty state aside — otherwise "Add note" on a brand-new
  // tracker would open a form nothing renders.
  const isEmpty = notes.length === 0 && noteCategories.length === 0 &&
    noteProjects.length === 0 && !adding && !addingCat

  return (
    <div className="notes-tracker">
      {!readOnly && (
        <>
          <div className="notes-add-bar">
            {/* Says where the note is going, because with a scope on it is
                no longer always Unfiled */}
            <button
              type="button"
              className="tasks-add-main"
              onClick={() => {
                if (scopedProject) expandSection(scopedProject.id)
                if (scopedCategory) expandSection(scopedCategory.id)
                openAdd(scopeAdd.key, scopeAdd.projectId, scopeAdd.categoryId, scopeAdd.context)
              }}
              disabled={selectMode}
            >
              <span className="task-add-plus">+</span> Add note
              {scope !== 'all' && scope !== 'unfiled' && ` to ${scopeAdd.context}`}
            </button>
            {/* A new project is only ever created at the top level, so it
                would be invisible under any scope but "All" */}
            {scope === 'all' && (
              <button
                type="button"
                className={`note-secondary-btn${addingProject ? ' note-secondary-btn--open' : ''}`}
                onClick={() => { setAdding(null); setAddingCat(null); setAddingProject(p => !p) }}
                disabled={selectMode}
              >
                + Project
              </button>
            )}
            {/* Same rule for categories: at the top level under "All", into
                the scoped project when one is showing, and nowhere sensible
                under a category or Unfiled scope */}
            {(scope === 'all' || scope === 'project') && (
              <button
                type="button"
                className={`note-secondary-btn${addingCat && addingCat.projectId === (scopedProject?.id ?? null) ? ' note-secondary-btn--open' : ''}`}
                onClick={() => {
                  setAddingProject(false)
                  if (scopedProject) expandSection(scopedProject.id)
                  openAddCategory(scopedProject?.id ?? null)
                }}
                disabled={selectMode}
              >
                + Category
              </button>
            )}
          </div>

          <SelectionBar
            selectMode={selectMode}
            count={selectedIds.size}
            onToggle={toggleSelectMode}
            onDeleteClick={() => setShowDeleteConfirm(true)}
          />

          {addingProject && (
            <ContainerForm
              heading="New project"
              placeholder="Project name"
              fallbackEmoji="📂"
              onSave={handleAddProject}
              onCancel={() => setAddingProject(false)}
            />
          )}
        </>
      )}

      {/* ── Scope picker ──
          Sits directly above what it filters. A plain <select> rather than a
          chip row: the list grows with every project and category, and this
          is the one control that has to stay usable at fifty of them. */}
      {showScopePicker && !isEmpty && (
        <div className="note-scope-bar">
          <NoteTreePicker
            options={scopeOptions}
            value={scope === 'all' ? 'all' : scopeKey}
            onChange={setScopeKey}
          />
          {scope !== 'all' && (
            <button
              type="button"
              className="note-scope-clear"
              onClick={() => setScopeKey('all')}
            >
              Show all
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p className="empty-title">No notes yet</p>
          <p className="empty-text">
            {readOnly
              ? 'Nothing written down.'
              : 'Add a note on its own, or make a project or category first and write inside it. Everything can be dragged somewhere else later.'}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* ── Projects, the outermost section tier ──
              A project scope keeps its whole section — header, categories
              and loose notes — so everything inside stays droppable. */}
          {(scope === 'all' || scope === 'project') && (
            <SortableContext
              items={(scopedProject ? [scopedProject] : displayProjects).map(p => `nproj-${p.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {(scopedProject ? [scopedProject] : displayProjects).map(renderProject)}
            </SortableContext>
          )}

          {/* ── A single scoped category, shown on its own ──
              Lifted out of whatever project holds it: the scope says to show
              this category's notes, and redrawing the project around it
              would put things on screen the scope just excluded. */}
          {scope === 'category' && (
            <SortableContext
              items={[`ncat-${scopedCategory.id}`]}
              strategy={verticalListSortingStrategy}
            >
              {renderCategory(scopedCategory)}
            </SortableContext>
          )}

          {/* ── Categories that belong to no project ── */}
          {scope === 'all' && (rootCats.length > 0 || (addingCat && addingCat.projectId === null)) && (
            <div className="note-root-cats">
              {addingCat && addingCat.projectId === null && (
                <ContainerForm
                  heading="New category"
                  placeholder="Category name"
                  fallbackEmoji="🗂️"
                  onSave={handleAddCategory}
                  onCancel={() => setAddingCat(null)}
                />
              )}
              <SortableContext
                items={rootCats.map(c => `ncat-${c.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {rootCats.map(renderCategory)}
              </SortableContext>
            </div>
          )}

          {/* ── Unfiled: notes in no category and no project ── */}
          {(scope === 'all' || scope === 'unfiled') && (
          <section
            ref={setRootRef}
            className={`note-unfiled${rootIsOver ? ' note-unfiled--over' : ''}`}
          >
            <div className="note-section-header note-section-header--root">
              <span className="note-section-emoji">📄</span>
              <span className="note-section-name">Unfiled</span>
              <span className="note-section-count">{rootNotes.length}</span>
              <span className="task-pane-spacer" />
              {!readOnly && !selectMode && (
                <button
                  type="button"
                  className={`note-mini-btn${adding?.key === 'root' ? ' note-mini-btn--open' : ''}`}
                  onClick={() => openAdd('root', null, null, 'Unfiled')}
                >
                  + Note
                </button>
              )}
            </div>
            <div className="note-unfiled-body">
              {renderNoteList(
                rootNotes,
                'root',
                readOnly ? 'Nothing unfiled.' : 'Nothing unfiled — drop a note here to take it out of its project or category.',
              )}
            </div>
          </section>
          )}

          <DragOverlay>
            {activeId?.startsWith('note-') && (() => {
              const n = notes.find(n => n.id === activeId.slice(5))
              return n ? (
                <div className="dnd-overlay note-overlay-card">
                  <span className="note-title">{n.title}</span>
                </div>
              ) : null
            })()}
            {activeId?.startsWith('ncat-') && (() => {
              const c = noteCategories.find(c => c.id === activeId.slice(5))
              return c ? (
                <div className="dnd-overlay cat-overlay-card">
                  <span className="cat-emoji">{c.emoji || '🗂️'}</span>
                  <span className="cat-name">{c.name}</span>
                </div>
              ) : null
            })()}
            {activeId?.startsWith('nproj-') && (() => {
              const p = noteProjects.find(p => p.id === activeId.slice(6))
              return p ? (
                <div className="dnd-overlay cat-overlay-card">
                  <span className="cat-emoji">{p.emoji || '📂'}</span>
                  <span className="cat-name">{p.name}</span>
                </div>
              ) : null
            })()}
          </DragOverlay>
        </DndContext>
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
