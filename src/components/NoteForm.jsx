import { useState, useRef, useEffect } from 'react'
import NoteTreePicker from './NoteTreePicker'

// Shared add/edit note form. Typing only — no drawing surface, by design.
//
// The In field is the non-dragging way to file a note: which section's "+"
// opened the form only seeds it, and changing it here moves the note just
// like dropping it somewhere would. Dragging is the quick gesture; this is
// the one that works on a phone, across a collapsed section, or when the
// destination is somewhere off-screen.
export default function NoteForm({
  initial = null,
  heading,
  locationOptions = [],
  defaultLocation = 'root',
  onSubmit,
  onCancel,
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
  const [location, setLocation] = useState(defaultLocation)
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    const body = content.trim()
    // A note with a body but no title is still worth keeping — the first
    // line of the body names it rather than the note being rejected.
    const finalTitle = trimmed || body.split('\n')[0].slice(0, 80)
    if (!finalTitle) return
    onSubmit({ title: finalTitle, content: body, location })
  }

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      {heading && <div className="note-form-heading">{heading}</div>}

      <input
        ref={titleRef}
        type="text"
        className="note-form-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title"
        maxLength={140}
      />

      <textarea
        className="note-form-content"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your note…"
        rows={6}
      />

      {locationOptions.length > 1 && (
        <div className="note-form-field">
          <label className="field-label">In</label>
          <NoteTreePicker
            options={locationOptions}
            value={location}
            onChange={setLocation}
            label="Where this note goes"
          />
        </div>
      )}

      <div className="note-form-actions">
        <button
          type="submit"
          className="cat-save-btn"
          disabled={!title.trim() && !content.trim()}
        >
          {initial ? 'Save' : 'Add note'}
        </button>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
