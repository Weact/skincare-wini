import { useEffect } from 'react'
import { CHANGELOG } from '../changelog'

export default function ChangelogModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">What's new</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {CHANGELOG.map((release, i) => (
            <div key={release.version} className="cl-release">
              <div className="cl-release-header">
                <span className="cl-version">v{release.version}</span>
                {i === 0 && <span className="cl-new-badge">New</span>}
                <span className="cl-date">{release.date}</span>
              </div>
              <ul className="cl-entries">
                {release.entries.map(entry => (
                  <li key={entry} className="cl-entry">{entry}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
