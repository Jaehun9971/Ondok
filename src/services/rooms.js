import {
  addDoc, arrayUnion, collection, deleteField, doc, getDocs, increment,
  limit, query, runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '../firebase'

const roomsRef = collection(db, 'rooms')

export function makeInviteCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function createRoom({ title, isPrivate, capacity, user }) {
  let code = null
  if (isPrivate) {
    do {
      code = makeInviteCode()
    } while (!(await getDocs(query(roomsRef, where('code', '==', code), limit(1)))).empty)
  }

  const room = {
    title,
    isPrivate,
    code,
    capacity,
    currentUsers: 1,
    ownerId: user.uid,
    memberIds: [user.uid],
    memberNames: { [user.uid]: user.displayName || '온독사용자' },
    createdAt: serverTimestamp(),
  }
  const roomDoc = await addDoc(roomsRef, room)
  return { id: roomDoc.id, ...room }
}

export async function joinRoom(roomId, user) {
  const roomRef = doc(db, 'rooms', roomId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new Error('존재하지 않는 방입니다.')
    const room = snapshot.data()
    if (room.memberIds?.includes(user.uid)) return
    if ((room.currentUsers || 0) >= room.capacity) throw new Error('방의 정원이 가득 찼습니다.')
    transaction.update(roomRef, {
      memberIds: arrayUnion(user.uid),
      [`memberNames.${user.uid}`]: user.displayName || '온독사용자',
      currentUsers: increment(1),
    })
  })
}

export async function findRoomByCode(code) {
  const result = await getDocs(query(roomsRef, where('code', '==', code), limit(1)))
  if (result.empty) return null
  const snapshot = result.docs[0]
  return { id: snapshot.id, ...snapshot.data() }
}

export function saveSelectedRoom(room) {
  sessionStorage.setItem('ondok-room-id', room.id)
}

export async function leaveRoom(roomId, userId) {
  const roomRef = doc(db, 'rooms', roomId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) return
    const room = snapshot.data()
    if (!room.memberIds?.includes(userId)) return
    if (room.memberIds.length === 1) {
      transaction.delete(roomRef)
      return
    }
    transaction.update(roomRef, {
      memberIds: room.memberIds.filter((id) => id !== userId),
      [`memberNames.${userId}`]: deleteField(),
      currentUsers: Math.max(0, (room.currentUsers || room.memberIds.length) - 1),
    })
  })
  sessionStorage.removeItem('ondok-room-id')
}
