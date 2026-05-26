import { useEffect } from 'react'

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

export default function SettingsPanel({ settings, onUpdate, onClose }) {
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

        </div>
      </div>
    </div>
  )
}
