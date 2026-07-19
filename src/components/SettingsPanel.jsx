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

export default function SettingsPanel({
  settings, onUpdate, onClose,
  showPrivacy, profile, onSetVisibility, onSetTrackerVisibilityMode, onSetTrackerVisibility, onSetAllTrackerVisibility,
}) {
  // Body weight for the workout calorie estimate — device-local, same key
  // WorkoutForm reads (and first asks for) when estimating
  const [weight, setWeight] = useState(() => localStorage.getItem('bodyWeightKg') || '')

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

  // Privacy controls only apply to the friend system, which is Google-linked
  // accounts only — showPrivacy is false (and profile is null) for anonymous
  // users, so this whole section just doesn't render for them.
  const visibility = profile?.profileVisibility || 'private'
  const trackerVisibilityMode = profile?.trackerVisibilityMode || 'global'
  const trackerVisibility = profile?.trackerVisibility || {}
  const isTrackerVisible = key => trackerVisibility[key] !== false
  const allTrackersVisible = TRACKERS.every(t => isTrackerVisible(t.key))
  const allTrackersHidden = TRACKERS.every(t => !isTrackerVisible(t.key))

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
            <div className="settings-section-title settings-section-title--lg">Trackers</div>
            <div className="field-hint">
              Unchecked trackers are hidden from the header entirely
            </div>
            <div className="tracker-toggle-list">
              {TRACKERS.map(t => (
                <label key={t.key} className="tracker-toggle-row">
                  <span className="tracker-toggle-icon">{t.icon}</span>
                  <span className="tracker-toggle-text">
                    <span className="tracker-toggle-label">{t.label}</span>
                  </span>
                  <span className="tracker-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.enabledTrackers.includes(t.key)}
                      onChange={() => toggleTracker(t.key)}
                    />
                    <span className="tracker-toggle-track"><span className="tracker-toggle-knob" /></span>
                  </span>
                </label>
              ))}
              <label className="tracker-toggle-row tracker-toggle-row--warning">
                <span className="tracker-toggle-icon">🔥</span>
                <span className="tracker-toggle-text">
                  <span className="tracker-toggle-label">
                    Positions <span className="settings-warning-badge">18+</span>
                  </span>
                  <span className="tracker-toggle-sublabel">
                    Explicit content — off by default, anyone with access to this device could see it once enabled
                  </span>
                </span>
                <span className="tracker-toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.positionsEnabled}
                    onChange={() => onUpdate('positionsEnabled', !settings.positionsEnabled)}
                  />
                  <span className="tracker-toggle-track"><span className="tracker-toggle-knob" /></span>
                </span>
              </label>
            </div>
          </div>

          {/* ── Privacy (friend system — Google-linked accounts only) ── */}
          {showPrivacy && (
            <div className="settings-section">
              <div className="settings-section-title settings-section-title--lg">Privacy</div>

              <div className="settings-subsection">
                <div className="field-label">Who can add you</div>
                <div className="settings-seg">
                  <button
                    className={`settings-seg-btn${visibility === 'public' ? ' settings-seg-btn--active' : ''}`}
                    onClick={() => onSetVisibility('public')}
                  >
                    Public
                  </button>
                  <button
                    className={`settings-seg-btn${visibility === 'private' ? ' settings-seg-btn--active' : ''}`}
                    onClick={() => onSetVisibility('private')}
                  >
                    Private
                  </button>
                </div>
                <div className="field-hint">
                  {visibility === 'public'
                    ? 'Anyone with your code can send you a friend request.'
                    : 'Friend requests to you are blocked. Friends you already have are unaffected.'}
                </div>
              </div>

              <div className="settings-subsection">
                <div className="field-label">Tracker visibility</div>
                <div className="field-hint">Once someone's your friend, choose what they can actually see.</div>
                <div className="settings-seg">
                  <button
                    className={`settings-seg-btn${trackerVisibilityMode === 'global' ? ' settings-seg-btn--active' : ''}`}
                    onClick={() => onSetTrackerVisibilityMode('global')}
                  >
                    Same for all
                  </button>
                  <button
                    className={`settings-seg-btn${trackerVisibilityMode === 'custom' ? ' settings-seg-btn--active' : ''}`}
                    onClick={() => onSetTrackerVisibilityMode('custom')}
                  >
                    Customize
                  </button>
                </div>

                {trackerVisibilityMode === 'global' ? (
                  <>
                    <div className="tracker-vis-toggle tracker-vis-toggle--global">
                      <button
                        type="button"
                        className={`tracker-vis-btn${allTrackersVisible ? ' tracker-vis-btn--active' : ''}`}
                        onClick={() => onSetAllTrackerVisibility(true)}
                      >
                        Visible
                      </button>
                      <button
                        type="button"
                        className={`tracker-vis-btn${allTrackersHidden ? ' tracker-vis-btn--active' : ''}`}
                        onClick={() => onSetAllTrackerVisibility(false)}
                      >
                        Hidden
                      </button>
                    </div>
                    <div className="field-hint">
                      Visible makes all your trackers open to friends on your shared profile. Hidden leaves all of them out entirely, as if you had none.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tracker-visibility-list">
                      {TRACKERS.map(t => {
                        const visible = isTrackerVisible(t.key)
                        return (
                          <div key={t.key} className="tracker-visibility-row">
                            <span className="tracker-visibility-label">{t.icon} {t.label}</span>
                            <div className="tracker-vis-toggle">
                              <button
                                type="button"
                                className={`tracker-vis-btn${visible ? ' tracker-vis-btn--active' : ''}`}
                                onClick={() => onSetTrackerVisibility(t.key, true)}
                              >
                                Visible
                              </button>
                              <button
                                type="button"
                                className={`tracker-vis-btn${!visible ? ' tracker-vis-btn--active' : ''}`}
                                onClick={() => onSetTrackerVisibility(t.key, false)}
                              >
                                Hidden
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="field-hint">
                      Set each tracker on its own — Visible ones open on your shared profile, Hidden ones are left out entirely, as if you didn't have them.
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

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
