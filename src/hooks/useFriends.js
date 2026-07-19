import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, query, where,
  getDoc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

function requestId(fromUid, toUid) {
  return `${fromUid}_${toUid}`
}

// Friends + friend requests for the current user. Friendship itself lives as
// a mirrored pair of docs, `users/{A}/friends/{B}` and `users/{B}/friends/{A}`
// — see firestore.rules for why (each side's own subcollection, no separate
// "friendship" document needed since the security check just looks for the
// requester's uid in the owner's own friends list).
export function useFriends(userId, myCode) {
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(collection(db, 'users', userId, 'friends'), snap => {
      setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    }, err => console.error('Friends error:', err))
    return unsub
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const q = query(collection(db, 'friendRequests'), where('to', '==', userId))
    const unsub = onSnapshot(q, snap => {
      setIncoming(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => console.error('Incoming requests error:', err))
    return unsub
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const q = query(collection(db, 'friendRequests'), where('from', '==', userId))
    const unsub = onSnapshot(q, snap => {
      setOutgoing(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => console.error('Outgoing requests error:', err))
    return unsub
  }, [userId])

  // Sends a friend request by the other person's code. Throws 'not-found',
  // 'self', 'already-friends', or 'already-sent' for the UI to explain —
  // the Firestore rules are the real enforcement (e.g. a Private target),
  // this is just a friendlier client-side check first.
  async function sendRequest(code) {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    const codeSnap = await getDoc(doc(db, 'profileCodes', trimmed))
    if (!codeSnap.exists()) throw new Error('not-found')
    const targetUid = codeSnap.data().uid
    if (targetUid === userId) throw new Error('self')
    if (friends.some(f => f.uid === targetUid)) throw new Error('already-friends')
    if (outgoing.some(r => r.to === targetUid)) throw new Error('already-sent')
    await setDoc(doc(db, 'friendRequests', requestId(userId, targetUid)), {
      from: userId,
      to: targetUid,
      fromCode: myCode,
      toCode: trimmed,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
  }

  // `request` is an incoming request object ({ id, from, fromCode, ... }).
  // Writes both sides of the friendship, then best-effort cleans up this
  // request and any reverse one (if both people happened to send at once).
  async function acceptRequest(request) {
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', userId, 'friends', request.from), {
      code: request.fromCode || null,
      alias: '',
      since: serverTimestamp(),
    })
    batch.set(doc(db, 'users', request.from, 'friends', userId), {
      code: myCode || null,
      alias: '',
      since: serverTimestamp(),
    })
    await batch.commit()
    await deleteDoc(doc(db, 'friendRequests', requestId(request.from, userId))).catch(() => {})
    await deleteDoc(doc(db, 'friendRequests', requestId(userId, request.from))).catch(() => {})
  }

  async function declineRequest(id) {
    await deleteDoc(doc(db, 'friendRequests', id))
  }

  // Same operation as declining — cancelling your own outgoing request just
  // deletes the same doc from the other side.
  const cancelRequest = declineRequest

  async function removeFriend(friendUid) {
    await deleteDoc(doc(db, 'users', userId, 'friends', friendUid))
    await deleteDoc(doc(db, 'users', friendUid, 'friends', userId)).catch(() => {})
  }

  async function setFriendAlias(friendUid, alias) {
    await updateDoc(doc(db, 'users', userId, 'friends', friendUid), { alias: alias.trim() })
  }

  return { friends, incoming, outgoing, sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriend, setFriendAlias }
}
