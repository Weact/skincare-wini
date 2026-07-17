import { useState, useEffect } from 'react'
import { TRACKERS } from '../constants'

const ACCENTS = [
  { key: 'rose',     color: '#c8727a', label: 'Rose'     },
  { key: 'peach',    color: '#d4855a', label: 'Peach'    },
  { key: 'gold',     color: '#c9984a', label: 'Gold'     },
  { key: 'sage',     color: '#5d9e6a', label: 'Sage'     },
  { key: 'sky',      color: '#4e8fc0', label: 'Sky'      },
  { key: 'lavender', color: '#8b7cc8', label: 'Lavender' },
]

const FONTS = [
  { key: 'system',  label: 'System',  preview: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { key: 'rounded', label: 'Rounded', preview: 'ui-rounded, Nunito, Varela Round, sans-serif'  },
  { key: 'serif',   label: 'Serif',   preview: 'Georgia, Times New Roman, serif'               },
]

const FONT_SIZES = [
  { key: 'sm', label: 'Small',  previewSize: '12px' },
  { key: 'md', label: 'Medium', previewSize: '17px' },
  { key: 'lg', label: 'Large',  previewSize: '22px' },
]

export default function SettingsPanel({ settings, onUpdate, onClose, user, profile, onSetVisibility, onAddViewer, onRemoveViewer, onViewProfile }) {
  // Body weight for the workout calorie estimate — device-local, same key
  // WorkoutForm reads (and first asks for) when estimating
  const [weight, setWeight] = useState(() => localStorage.getItem('bodyWeightKg') || '')
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [viewerCodeCopied, setViewerCodeCopied] = useState(false)
  const [viewerCodeInput, setViewerCodeInput] = useState('')
  const [addViewerError, setAddViewerError] = useState('')

  const visibility = profile?.profileVisibility || 'private'

  function handleCopyCode() {
    if (!profile?.profileCode) return
    navigator.clipboard?.writeText(profile.profileCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleCopyViewerCode() {
    if (!profile?.viewerCode) return
    navigator.clipboard?.writeText(profile.viewerCode)
    setViewerCodeCopied(true)
    setTimeout(() => setViewerCodeCopied(false), 2000)
  }

  async function handleAddViewer() {
    const code = viewerCodeInput.trim()
    if (!code) return
    setAddViewerError('')
    try {
      await onAddViewer(code)
      setViewerCodeInput('')
    } catch {
      setAddViewerError("That code doesn't match anyone")
    }
  }

  function handleViewSubmit() {
    const code = codeInput.trim()
    if (!code) return
    onViewProfile(code)
  }

  function handleWeightChange(e) {
    const val = e.target.value
    setWeight(val)
    const kg = parseFloat(val)
    if (kg > 0) localStorage.setItem('bodyWeightKg', String(kg))
    else localStorage.removeItem('bodyWeightKg')
  }

  const workoutEnabled = settings.enabledTrackers.includes('workout')

  function toggleTracker(key) {
    const next = settings.enabledTrackers.includes(key)
      ? settings.enabledTrackers.filter(k => k !== key)
      : [...settings.enabledTrackers, key]
    onUpdate('enabledTrackers', next)
  }

  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">

          {/* ── Trackers ── */}
          <div className="settings-section">
            <div className="settings-section-title">Trackers</div>
            <div className="field-hint">
              Unchecked trackers are hidden from the header entirely
            </div>
            <div className="settings-tracker-list">
              {TRACKERS.map(t => (
                <label key={t.key} className="cal-hide-expired">
                  <input
                    type="checkbox"
                    checked={settings.enabledTrackers.includes(t.key)}
                    onChange={() => toggleTracker(t.key)}
                  />
                  {t.icon} {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* ── Appearance ── */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>
            <div className="settings-seg">
              <button
                className={`settings-seg-btn${settings.theme === 'light' ? ' settings-seg-btn--active' : ''}`}
                onClick={() => onUpdate('theme', 'light')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Light
              </button>
              <button
                className={`settings-seg-btn${settings.theme === 'dark' ? ' settings-seg-btn--active' : ''}`}
                onClick={() => onUpdate('theme', 'dark')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Dark
              </button>
            </div>
          </div>

          {/* ── Accent colour ── */}
          <div className="settings-section">
            <div className="settings-section-title">Accent colour</div>
            <div className="settings-accent-row">
              {ACCENTS.map(a => (
                <button
                  key={a.key}
                  className={`settings-swatch${settings.accent === a.key ? ' settings-swatch--active' : ''}`}
                  style={{ background: a.color }}
                  onClick={() => onUpdate('accent', a.key)}
                  aria-label={a.label}
                  title={a.label}
                />
              ))}
            </div>
          </div>

          {/* ── Font ── */}
          <div className="settings-section">
            <div className="settings-section-title">Font</div>
            <div className="settings-pill-row">
              {FONTS.map(f => (
                <button
                  key={f.key}
                  className={`settings-pill${settings.font === f.key ? ' settings-pill--active' : ''}`}
                  onClick={() => onUpdate('font', f.key)}
                >
                  <span className="settings-pill-preview" style={{ fontFamily: f.preview }}>Aa</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Text size ── */}
          <div className="settings-section">
            <div className="settings-section-title">Text size</div>
            <div className="settings-pill-row">
              {FONT_SIZES.map(s => (
                <button
                  key={s.key}
                  className={`settings-pill${settings.fontSize === s.key ? ' settings-pill--active' : ''}`}
                  onClick={() => onUpdate('fontSize', s.key)}
                >
                  <span className="settings-pill-preview" style={{ fontSize: s.previewSize }}>A</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Profile sharing — locked to non-anonymous accounts, both to
              offer a code and to look one up, so a throwaway session can't
              use it at all ── */}
          {user && !user.isAnonymous && (
            <div className="settings-section">
              <div className="settings-section-title">Profile sharing</div>
              <div className="field-hint">
                Share a read-only view of your Workouts and Poop tracker. Your Skincare routine and calendars always stay private.
              </div>
              <div className="settings-seg">
                <button
                  className={`settings-seg-btn${visibility === 'private' ? ' settings-seg-btn--active' : ''}`}
                  onClick={() => onSetVisibility('private')}
                >
                  Private
                </button>
                <button
                  className={`settings-seg-btn${visibility === 'public' ? ' settings-seg-btn--active' : ''}`}
                  onClick={() => onSetVisibility('public')}
                >
                  Public
                </button>
                <button
                  className={`settings-seg-btn${visibility === 'whitelist' ? ' settings-seg-btn--active' : ''}`}
                  onClick={() => onSetVisibility('whitelist')}
                >
                  Whitelist
                </button>
              </div>

              {visibility !== 'private' && profile?.profileCode && (
                <div className="profile-code-row">
                  <span className="profile-code">{profile.profileCode}</span>
                  <button type="button" className="cat-save-btn" onClick={handleCopyCode}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {visibility === 'whitelist' && (
                <div className="field">
                  <label className="field-label">Allowed viewers</label>
                  <div className="field-hint">
                    Only people whose viewer code you add here can view your shared profile.
                  </div>
                  {profile?.allowedViewerUids?.length > 0 && (
                    <ul className="whitelist-list">
                      {profile.allowedViewerUids.map(id => (
                        <li key={id} className="whitelist-item">
                          <span className="whitelist-item-id">{id}</span>
                          <button
                            type="button"
                            className="type-current-remove"
                            onClick={() => onRemoveViewer(id)}
                            aria-label="Remove viewer"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="profile-view-row">
                    <input
                      type="text"
                      className="field-input"
                      value={viewerCodeInput}
                      onChange={e => { setViewerCodeInput(e.target.value.toUpperCase()); setAddViewerError('') }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddViewer() }}
                      placeholder="Paste their viewer code"
                      maxLength={7}
                    />
                    <button
                      type="button"
                      className="wk-auto-btn"
                      onClick={handleAddViewer}
                      disabled={!viewerCodeInput.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {addViewerError && <div className="field-hint field-hint--error">{addViewerError}</div>}
                </div>
              )}

              <div className="field">
                <label className="field-label">Your viewer code</label>
                <div className="field-hint">
                  Give this to someone so they can add you to their whitelist — it's a separate code from your share code above, and never reveals your account ID
                </div>
                <div className="profile-view-row">
                  <span className="profile-code">{profile?.viewerCode || 'Generating…'}</span>
                  <button type="button" className="cat-save-btn" onClick={handleCopyViewerCode} disabled={!profile?.viewerCode}>
                    {viewerCodeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="field-label">View a shared profile</label>
                <div className="profile-view-row">
                  <input
                    type="text"
                    className="field-input"
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') handleViewSubmit() }}
                    placeholder="Enter a code"
                    maxLength={7}
                  />
                  <button
                    type="button"
                    className="wk-auto-btn"
                    onClick={handleViewSubmit}
                    disabled={!codeInput.trim()}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Workout ── */}
          <div className="settings-section">
            <div className="settings-section-title">Workout</div>
            <div className="field">
              <label className="field-label">Body weight</label>
              <div className="field-hint">
                {workoutEnabled
                  ? 'Used for the calorie auto-estimate — stored on this device only'
                  : 'This option is disabled since Workouts is not enabled on this account. To be able to change it, enable Workouts in the Trackers settings above.'}
              </div>
              <div className="cal-duration-input settings-weight">
                <input
                  type="number"
                  min="1"
                  className="field-input"
                  value={weight}
                  onChange={handleWeightChange}
                  placeholder="70"
                  disabled={!workoutEnabled}
                />
                <span className="cal-duration-suffix">kg</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
