import { useState } from 'react'

const SEND_ERRORS = {
  'not-found': "That code doesn't match anyone",
  'self': "That's your own code",
  'already-friends': "You're already friends",
  'already-sent': 'Request already sent',
}

// Friend system panel: privacy toggle, your own friend code, sending/
// accepting/declining requests, and the friend list itself (each entry
// editable with a private nickname, plus a button to view their shared
// profile). Slides in over the tracker area rather than opening as a modal.
export default function FriendsPanel({ onClose, profile, onSetVisibility, friends, incoming, outgoing, onSendRequest, onAcceptRequest, onDeclineRequest, onCancelRequest, onRemoveFriend, onSetAlias, onViewFriend }) {
  const [codeInput, setCodeInput] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const visibility = profile?.profileVisibility || 'private'

  function handleCopyCode() {
    if (!profile?.profileCode) return
    navigator.clipboard?.writeText(profile.profileCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSend() {
    const code = codeInput.trim()
    if (!code) return
    setSendError('')
    setSending(true)
    try {
      await onSendRequest(code)
      setCodeInput('')
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
        <div className="settings-section-title">Who can add you</div>
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

      <div className="settings-section">
        <div className="settings-section-title">Add a friend</div>
        <div className="profile-view-row">
          <input
            type="text"
            className="field-input"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setSendError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder="Enter their friend code"
            maxLength={7}
          />
          <button
            type="button"
            className="wk-auto-btn"
            onClick={handleSend}
            disabled={!codeInput.trim() || sending}
          >
            Send
          </button>
        </div>
        {sendError && <div className="field-hint field-hint--error">{sendError}</div>}
      </div>

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
        <div className="settings-section-title">Your friends</div>
        {friends.length === 0 ? (
          <div className="field-hint">No friends yet — send a code above to add one.</div>
        ) : (
          <ul className="whitelist-list">
            {friends.map(friend => (
              <li key={friend.uid} className="whitelist-item">
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
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
