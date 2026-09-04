import { useState, useRef, useEffect } from 'react'

// Shared add/edit note form. Typing only — no drawing surface, by design.
// Where a new note lands is decided by which section's "+" opened this
// form, so there is deliberately no project/category picker here: moving a
// note is drag-and-drop's job, and duplicating it as a dropdown would give
// two controls that can disagree about the same thing.
export default function NoteForm({ initial = null, heading, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
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
    onSubmit({ title: finalTitle, content: body })
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
