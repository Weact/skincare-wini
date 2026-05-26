import { useState, useRef, useEffect } from 'react'

export default function AuthButton({ user, onLinkGoogle, onSignOut }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function handleOutside(e) {
      if (!menuRef.current?.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMenu])

  if (user === undefined) return null

  // Anonymous user — show Sync button
  if (!user || user.isAnonymous) {
    return (
      <button className="auth-btn" onClick={onLinkGoogle} title="Sign in to sync across devices">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Sync</span>
      </button>
    )
  }

  // Google user — show avatar
  const initial = (user.displayName?.[0] || user.email?.[0] || 'G').toUpperCase()

  return (
    <div className="auth-avatar-wrap" ref={menuRef}>
      <button
        className="auth-avatar"
        onClick={() => setShowMenu(s => !s)}
        title={user.displayName || user.email}
      >
        {user.photoURL
          ? <img src={user.photoURL} alt="" />
          : <span>{initial}</span>
        }
      </button>

      {showMenu && (
        <div className="auth-menu">
          <p className="auth-menu-name">{user.displayName || user.email}</p>
          <button
            className="auth-menu-signout"
            onClick={() => { setShowMenu(false); onSignOut() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
