import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

import {
  createInviteCode,
  hashInviteCode,
  normalizeInviteCode,
  normalizeNickname,
  normalizeRoomInput,
} from './validation.js'

initializeApp()
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 20 })

const db = getFirestore()

function requireUser(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  }
  return request.auth
}

function validationError(error) {
  const messages = {
    'invalid-title': '방 이름은 1자 이상 40자 이하여야 합니다.',
    'invalid-room-type': '지원하지 않는 방 유형입니다.',
    'invalid-capacity': '최대 인원은 2명 이상 6명 이하여야 합니다.',
    'invalid-nickname': '닉네임은 1자 이상 20자 이하여야 합니다.',
    'invalid-invite-code': '초대 코드는 숫자 6자리여야 합니다.',
  }
  return new HttpsError('invalid-argument', messages[error.message] ?? '입력값이 올바르지 않습니다.')
}

function memberData(auth, nickname, studying = false) {
  return {
    uid: auth.uid,
    nickname,
    photoURL: auth.token.picture ?? null,
    studying,
    cameraEnabled: false,
    timerStartedAt: null,
    accumulatedSeconds: 0,
    joinedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  }
}

export const upsertProfile = onCall(async (request) => {
  const auth = requireUser(request)
  let nickname
  try {
    nickname = normalizeNickname(request.data?.nickname ?? auth.token.name)
  } catch (error) {
    throw validationError(error)
  }

  const profile = {
    nickname,
    photoURL: auth.token.picture ?? null,
    provider: auth.token.firebase?.sign_in_provider ?? 'custom',
    updatedAt: FieldValue.serverTimestamp(),
  }

  const userRef = db.collection('users').doc(auth.uid)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)
    transaction.set(
      userRef,
      snapshot.exists
        ? profile
        : { ...profile, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  })

  return { uid: auth.uid, nickname }
})

export const createRoom = onCall(async (request) => {
  const auth = requireUser(request)
  let input
  let nickname
  try {
    input = normalizeRoomInput(request.data)
    nickname = normalizeNickname(request.data?.nickname ?? auth.token.name)
  } catch (error) {
    throw validationError(error)
  }

  const roomRef = db.collection('rooms').doc()
  let inviteCode = null
  let inviteRef = null

  if (input.type === 'private') {
    inviteCode = createInviteCode()
    inviteRef = db.collection('roomInvites').doc(hashInviteCode(inviteCode))
  }

  await db.runTransaction(async (transaction) => {
    if (inviteRef) {
      const existingInvite = await transaction.get(inviteRef)
      if (existingInvite.exists) {
        throw new HttpsError('aborted', '초대 코드 생성이 충돌했습니다. 다시 시도해 주세요.')
      }
    }

    transaction.create(roomRef, {
      ...input,
      ownerId: auth.uid,
      memberCount: 1,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.create(roomRef.collection('members').doc(auth.uid), memberData(auth, nickname))
    if (inviteRef) {
      transaction.create(inviteRef, {
        roomId: roomRef.id,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  })

  return { roomId: roomRef.id, inviteCode }
})

export const joinRoom = onCall(async (request) => {
  const auth = requireUser(request)
  let nickname
  try {
    nickname = normalizeNickname(request.data?.nickname ?? auth.token.name)
  } catch (error) {
    throw validationError(error)
  }

  let roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : ''
  const suppliedCode = request.data?.inviteCode

  if (suppliedCode != null) {
    let inviteCode
    try {
      inviteCode = normalizeInviteCode(suppliedCode)
    } catch (error) {
      throw validationError(error)
    }
    const invite = await db.collection('roomInvites').doc(hashInviteCode(inviteCode)).get()
    if (!invite.exists) {
      throw new HttpsError('not-found', '유효하지 않은 초대 코드입니다.')
    }
    roomId = invite.data().roomId
  }

  if (!roomId) {
    throw new HttpsError('invalid-argument', 'roomId 또는 inviteCode가 필요합니다.')
  }

  const roomRef = db.collection('rooms').doc(roomId)
  const memberRef = roomRef.collection('members').doc(auth.uid)

  await db.runTransaction(async (transaction) => {
    const [roomSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(memberRef),
    ])

    if (!roomSnapshot.exists) {
      throw new HttpsError('not-found', '존재하지 않는 방입니다.')
    }

    const room = roomSnapshot.data()
    if (room.status !== 'open') {
      throw new HttpsError('failed-precondition', '이미 종료된 방입니다.')
    }
    if (room.type === 'private' && suppliedCode == null && !memberSnapshot.exists) {
      throw new HttpsError('permission-denied', '비공개방 초대 코드가 필요합니다.')
    }
    if (memberSnapshot.exists) return
    if (room.memberCount >= room.capacity) {
      throw new HttpsError('resource-exhausted', '방 정원이 가득 찼습니다.')
    }

    transaction.create(memberRef, memberData(auth, nickname))
    transaction.update(roomRef, {
      memberCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return { roomId }
})

export const updateMemberStatus = onCall(async (request) => {
  const auth = requireUser(request)
  const roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : ''
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'roomId가 필요합니다.')
  }

  const updates = { lastSeenAt: FieldValue.serverTimestamp() }
  if (typeof request.data?.studying === 'boolean') updates.studying = request.data.studying
  if (typeof request.data?.cameraEnabled === 'boolean') updates.cameraEnabled = request.data.cameraEnabled
  if (request.data?.timerStartedAt === null) updates.timerStartedAt = null
  if (request.data?.timerStartedAt === 'now') updates.timerStartedAt = FieldValue.serverTimestamp()
  if (Number.isInteger(request.data?.accumulatedSeconds) && request.data.accumulatedSeconds >= 0) {
    updates.accumulatedSeconds = request.data.accumulatedSeconds
  }

  const memberRef = db.collection('rooms').doc(roomId).collection('members').doc(auth.uid)
  if (!(await memberRef.get()).exists) {
    throw new HttpsError('permission-denied', '이 방의 참여자가 아닙니다.')
  }
  await memberRef.update(updates)
  return { roomId, updated: true }
})

export const leaveRoom = onCall(async (request) => {
  const auth = requireUser(request)
  const roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : ''
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'roomId가 필요합니다.')
  }

  const roomRef = db.collection('rooms').doc(roomId)
  const memberRef = roomRef.collection('members').doc(auth.uid)
  let ownerClosedRoom = false

  await db.runTransaction(async (transaction) => {
    const [roomSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(memberRef),
    ])
    if (!roomSnapshot.exists || !memberSnapshot.exists) return

    const room = roomSnapshot.data()
    transaction.delete(memberRef)

    if (room.ownerId === auth.uid || room.memberCount <= 1) {
      ownerClosedRoom = true
      transaction.update(roomRef, {
        status: 'closed',
        memberCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      transaction.update(roomRef, {
        memberCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  })

  if (ownerClosedRoom) {
    const [members, invites] = await Promise.all([
      roomRef.collection('members').get(),
      db.collection('roomInvites').where('roomId', '==', roomId).get(),
    ])
    const batch = db.batch()
    members.docs.forEach((document) => batch.delete(document.ref))
    invites.docs.forEach((document) => batch.delete(document.ref))
    await batch.commit()
  }

  return { roomId, roomClosed: ownerClosedRoom }
})
