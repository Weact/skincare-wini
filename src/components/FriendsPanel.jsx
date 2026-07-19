import { useState } from 'react'

const SEND_ERRORS = {
  'not-found': "That code doesn't match anyone",
  'self': "That's your own code",
  'already-friends': "You're already friends",
  'already-sent': 'Request already sent',
  'not-accepting': "That person isn't accepting friend requests right now (they're set to Private)",
}

// Friend system panel: your own friend code, sending/accepting/declining
// requests, and the friend list itself (each entry editable with a private
// nickname, plus a button to view their shared profile). Slides in over the
// tracker area rather than opening as a modal. Privacy controls (who can add
// you, tracker visibility) live in Settings → Privacy instead — this panel
// is purely about the friend list/requests now.
export default function FriendsPanel({ onClose, profile, friends, incoming, outgoing, onSendRequest, onAcceptRequest, onDeclineRequest, onCancelRequest, onRemoveFriend, onSetAlias, onViewFriend }) {
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopyCode() {
    if (!profile?.profileCode) return
    navigator.clipboard?.writeText(profile.profileCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openAddFriend() {
    setCodeInput('')
    setSendError('')
    setShowAddFriend(true)
  }

  async function handleSend() {
    const code = codeInput.trim()
    if (!code) return
    setSendError('')
    setSending(true)
    try {
      await onSendRequest(code)
      setCodeInput('')
      setShowAddFriend(false)
    } catch (err) {
      setSendError(SEND_ERRORS[err.message] || 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  function handleAliasBlur(uid, value) {
    const friend = friends.find(f => f.uid === uid)
    if ((friend?.alias || '') === value.trim()) return
    onSetAlias(uid, value)
  }

  return (
    <div className="friends-panel">
      <div className="shared-profile-header">
        <span className="shared-profile-title">👥 Friends</span>
        <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Your friend code</div>
        <div className="profile-code-row">
          <span className="profile-code">{profile?.profileCode || 'Generating…'}</span>
          <button type="button" className="cat-save-btn" onClick={handleCopyCode} disabled={!profile?.profileCode}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="field-hint">Share this so someone can add you as a friend.</div>
      </div>

      <button type="button" className="new-cat-btn" onClick={openAddFriend}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        Add a friend
      </button>

      {incoming.length > 0 && (
        <div className="settings-section">
          <div className="settings-section-title">Friend requests</div>
          <ul className="whitelist-list">
            {incoming.map(req => (
              <li key={req.id} className="whitelist-item">
                <div className="whitelist-item-info">
                  <span className="whitelist-item-code">{req.fromCode || req.from}</span>
                </div>
                <div className="friend-request-actions">
                  <button type="button" className="cat-save-btn" onClick={() => onAcceptRequest(req)}>Accept</button>
                  <button type="button" className="type-current-remove" onClick={() => onDeclineRequest(req.id)} aria-label="Decline">✕</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="settings-section">
          <div className="settings-section-title">Sent requests</div>
          <ul className="whitelist-list">
            {outgoing.map(req => (
              <li key={req.id} className="whitelist-item">
                <div className="whitelist-item-info">
                  <span className="whitelist-item-code">{req.toCode || req.to}</span>
                  <span className="field-hint">Waiting for them to accept</span>
                </div>
                <button type="button" className="type-current-remove" onClick={() => onCancelRequest(req.id)} aria-label="Cancel request">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title settings-section-title--lg">Your friends</div>
        {friends.length === 0 ? (
          <div className="field-hint">No friends yet — send a code above to add one.</div>
        ) : (
          <ul className="friend-list">
            {friends.map(friend => {
              const initial = (friend.alias || friend.code || '?').trim().charAt(0).toUpperCase()
              return (
                <li key={friend.uid} className="friend-card">
                  <span className="friend-avatar" aria-hidden="true">{initial}</span>
                  <div className="whitelist-item-info">
                    <input
                      type="text"
                      className="whitelist-item-alias"
                      defaultValue={friend.alias || ''}
                      placeholder="Add a nickname"
                      onBlur={e => handleAliasBlur(friend.uid, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                    <span className="whitelist-item-code">{friend.code || friend.uid}</span>
                  </div>
                  <div className="friend-request-actions">
                    <button
                      type="button"
                      className="cat-save-btn"
                      onClick={() => onViewFriend(friend.uid, friend.alias || friend.code)}
                    >
                      View
                    </button>
                    <button type="button" className="type-current-remove" onClick={() => onRemoveFriend(friend.uid)} aria-label="Remove friend">✕</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showAddFriend && (
        <div className="modal-backdrop" onClick={() => setShowAddFriend(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add a friend</span>
              <button className="modal-close" onClick={() => setShowAddFriend(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">Their friend code</label>
                <input
                  type="text"
                  className="field-input"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase()); setSendError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Enter their friend code"
                  maxLength={7}
                  autoFocus
                />
                {sendError && <div className="field-hint field-hint--error">{sendError}</div>}
              </div>
              <div className="delete-confirm-actions">
                <button type="button" className="cat-cancel-btn cat-cancel-btn--text" onClick={() => setShowAddFriend(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cat-save-btn"
                  onClick={handleSend}
                  disabled={!codeInput.trim() || sending}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
