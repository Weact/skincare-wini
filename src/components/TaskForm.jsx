import { useState, useRef, useEffect } from 'react'
import { TASK_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../constants'
import DateInput from './DateInput'
import EmojiPicker from './EmojiPicker'

// Shared add/edit task form. `initial` = the task being edited (null = new);
// `defaultDate` seeds the date for a brand-new task and is what each section's
// own "+" passes in, so adding from Undated starts undated, adding from Today
// starts on today, and adding from a Future month starts in that month.
//
// Categories and labels are both created — and labels re-coloured, renamed or
// deleted — inline from here, which is what makes "create a category in any
// section" work: every section's "+" opens this one form.
export default function TaskForm({
  initial = null,
  defaultDate = null,
  heading,
  categories,
  labels,
  onAddCategory,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
  onSubmit,
  onCancel,
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(initial ? (initial.date || '') : (defaultDate || ''))
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '')
  const [labelIds, setLabelIds] = useState(initial?.labelIds || [])
  const [notes, setNotes] = useState(initial?.notes || '')

  // Inline editors. `catDraft` is only ever a new category; `labelDraft`
  // doubles for new labels and for editing an existing one (`id` set).
  const [catDraft, setCatDraft] = useState(null)     // { name, emoji } | null
  const [labelDraft, setLabelDraft] = useState(null) // { id?, name, emoji, color } | null
  const [catEmojiOpen, setCatEmojiOpen] = useState(false)
  const [labelEmojiOpen, setLabelEmojiOpen] = useState(false)
  const [editLabels, setEditLabels] = useState(false)
  const catEmojiRef = useRef(null)
  const labelEmojiRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    function handle(e) {
      if (catEmojiRef.current && !catEmojiRef.current.contains(e.target)) setCatEmojiOpen(false)
      if (labelEmojiRef.current && !labelEmojiRef.current.contains(e.target)) setLabelEmojiOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  function toggleLabel(id) {
    setLabelIds(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  async function saveCategory() {
    const name = catDraft?.name.trim()
    if (!name) { setCatDraft(null); return }
    const id = await onAddCategory(name, catDraft.emoji)
    if (id) setCategoryId(id)
    setCatDraft(null)
  }

  async function saveLabel() {
    const name = labelDraft?.name.trim()
    if (!name) { setLabelDraft(null); return }
    if (labelDraft.id) {
      await onUpdateLabel(labelDraft.id, {
        name,
        emoji: labelDraft.emoji,
        color: labelDraft.color,
      })
    } else {
      const id = await onAddLabel(name, labelDraft.emoji, labelDraft.color)
      if (id) setLabelIds(list => [...list, id])
    }
    setLabelDraft(null)
  }

  async function removeLabel() {
    if (!labelDraft?.id) return
    const id = labelDraft.id
    setLabelDraft(null)
    setLabelIds(list => list.filter(x => x !== id))
    await onDeleteLabel(id)
  }

  // In edit mode a chip opens its editor instead of toggling selection
  function handleLabelChipClick(l) {
    if (editLabels) {
      setLabelDraft({
        id: l.id,
        name: l.name,
        emoji: l.emoji || '',
        color: l.color || DEFAULT_LABEL_COLOR,
      })
      return
    }
    toggleLabel(l.id)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({
      title: trimmed,
      date: date || null,
      categoryId: categoryId || null,
      labelIds,
      notes: notes.trim(),
    })
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      {heading && <div className="task-form-heading">{heading}</div>}

      <input
        ref={titleRef}
        type="text"
        className="task-form-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What needs doing?"
        maxLength={140}
      />

      <div className="task-form-row">
        <label className="field-label">Date</label>
        <div className="task-form-date">
          <DateInput value={date} onChange={e => setDate(e.target.value)} />
          <button
            type="button"
            className={`task-nodate-btn${!date ? ' task-nodate-btn--active' : ''}`}
            onClick={() => setDate('')}
          >
            No date
          </button>
        </div>
        <div className="field-hint">
          Tasks with no date collect in the Undated section at the bottom.
        </div>
      </div>

      <div className="task-form-row">
        <label className="field-label">Category</label>
        <div className="task-chip-row">
          <button
            type="button"
            className={`task-chip${!categoryId ? ' task-chip--active' : ''}`}
            onClick={() => setCategoryId('')}
          >
            None
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              className={`task-chip${categoryId === c.id ? ' task-chip--active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.emoji && <span className="task-chip-emoji">{c.emoji}</span>}
              {c.name}
            </button>
          ))}
          {!catDraft && (
            <button
              type="button"
              className="task-chip task-chip--add"
              onClick={() => setCatDraft({ name: '', emoji: '' })}
            >
              + New
            </button>
          )}
        </div>
        {catDraft && (
          <div className="task-inline-create">
            <div className="task-inline-row">
              {/* The picker positions itself (.cat-emoji-picker is absolute) —
                  it must NOT be wrapped in another sized box, or it ends up
                  scrolling inside a few hundred cramped pixels. */}
              <div className="cat-emoji-wrap" ref={catEmojiRef}>
                <button
                  type="button"
                  className="cat-emoji-btn"
                  onClick={() => setCatEmojiOpen(o => !o)}
                  aria-label="Pick a category emoji"
                >
                  {catDraft.emoji || '🙂'}
                </button>
                {catEmojiOpen && (
                  <EmojiPicker
                    value={catDraft.emoji}
                    onSelect={val => { setCatDraft(c => ({ ...c, emoji: val })); setCatEmojiOpen(false) }}
                  />
                )}
              </div>
              <input
                type="text"
                className="task-inline-input"
                value={catDraft.name}
                onChange={e => setCatDraft(c => ({ ...c, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCategory() } }}
                placeholder="Category name"
                maxLength={40}
                autoFocus
              />
            </div>
            <div className="task-inline-actions">
              <button type="button" className="task-inline-save" onClick={saveCategory}>Add</button>
              <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={() => setCatDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="task-form-row">
        <div className="task-form-rowhead">
          <label className="field-label">Labels</label>
          {labels.length > 0 && (
            <button
              type="button"
              className={`task-edit-toggle${editLabels ? ' task-edit-toggle--on' : ''}`}
              onClick={() => { setEditLabels(v => !v); setLabelDraft(null) }}
            >
              {editLabels ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
        {editLabels && (
          <div className="field-hint">Tap a label to rename it, recolour it, or delete it.</div>
        )}
        <div className="task-chip-row">
          {labels.length === 0 && !labelDraft && (
            <span className="task-chip-empty">No labels yet</span>
          )}
          {labels.map(l => {
            const on = labelIds.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                className={[
                  'task-chip',
                  `task-chip--${l.color || DEFAULT_LABEL_COLOR}`,
                  on && !editLabels ? 'task-chip--on' : '',
                  editLabels ? 'task-chip--editable' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleLabelChipClick(l)}
                aria-pressed={editLabels ? undefined : on}
              >
                {/* A selected label keeps its own colour, so the tick — not a
                    colour change — is what says "on"; every label flipping to
                    the accent would make the palette pointless */}
                {on && !editLabels && <span className="task-chip-tick">✓</span>}
                {l.emoji && <span className="task-chip-emoji">{l.emoji}</span>}
                {l.name}
                {editLabels && <span className="task-chip-pencil">✎</span>}
              </button>
            )
          })}
          {!labelDraft && (
            <button
              type="button"
              className="task-chip task-chip--add"
              onClick={() => {
                setEditLabels(false)
                setLabelDraft({ name: '', emoji: '', color: DEFAULT_LABEL_COLOR })
              }}
            >
              + New
            </button>
          )}
        </div>
        {labelDraft && (
          <div className="task-inline-create">
            <div className="task-inline-row">
              <div className="cat-emoji-wrap" ref={labelEmojiRef}>
                <button
                  type="button"
                  className="cat-emoji-btn"
                  onClick={() => setLabelEmojiOpen(o => !o)}
                  aria-label="Pick a label emoji"
                >
                  {labelDraft.emoji || '🏷️'}
                </button>
                {labelEmojiOpen && (
                  <EmojiPicker
                    value={labelDraft.emoji}
                    onSelect={val => { setLabelDraft(l => ({ ...l, emoji: val })); setLabelEmojiOpen(false) }}
                  />
                )}
              </div>
              <input
                type="text"
                className="task-inline-input"
                value={labelDraft.name}
                onChange={e => setLabelDraft(l => ({ ...l, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveLabel() } }}
                placeholder="Label name"
                maxLength={40}
                autoFocus
              />
            </div>

            <div className="task-swatch-row" role="group" aria-label="Label colour">
              {TASK_LABEL_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  className={[
                    'task-swatch',
                    `task-swatch--${c.key}`,
                    labelDraft.color === c.key ? 'task-swatch--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setLabelDraft(l => ({ ...l, color: c.key }))}
                  aria-label={c.label}
                  aria-pressed={labelDraft.color === c.key}
                  title={c.label}
                />
              ))}
            </div>

            <div className="task-inline-preview">
              <span className="field-hint">Preview</span>
              <span className={`task-label-chip task-label-chip--${labelDraft.color}`}>
                {labelDraft.emoji && <span className="task-chip-emoji">{labelDraft.emoji}</span>}
                {labelDraft.name.trim() || 'Label'}
              </span>
            </div>

            <div className="task-inline-actions">
              <button type="button" className="task-inline-save" onClick={saveLabel}>
                {labelDraft.id ? 'Save' : 'Add'}
              </button>
              {labelDraft.id && (
                <button type="button" className="task-action-btn task-action-btn--danger" onClick={removeLabel}>
                  Delete
                </button>
              )}
              <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={() => setLabelDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="task-form-row">
        <label className="field-label">Notes</label>
        <textarea
          className="task-form-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional details"
          rows={2}
        />
      </div>

      <div className="task-form-actions">
        <button type="submit" className="cat-save-btn" disabled={!title.trim()}>
          {initial ? 'Save' : 'Add task'}
        </button>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
