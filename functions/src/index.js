import { initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'

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
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  return request.auth
}

function validationError(error) {
  const messages = {
    'invalid-title': '방 이름은 1자 이상 40자 이하여야 합니다.',
    'invalid-room-type': '공개방 또는 비공개방 여부가 필요합니다.',
    'invalid-capacity': '최대 인원은 2명 이상 6명 이하여야 합니다.',
    'invalid-nickname': '닉네임은 1자 이상 20자 이하여야 합니다.',
    'invalid-invite-code': '초대 코드는 숫자 6자리여야 합니다.',
  }
  return new HttpsError('invalid-argument', messages[error.message] ?? '입력값이 올바르지 않습니다.')
}

function getNickname(request, auth) {
  return normalizeNickname(request.data?.nickname ?? auth.token.name ?? '온독사용자')
}

function memberData(auth, nickname) {
  return {
    uid: auth.uid,
    nickname,
    photoURL: auth.token.picture ?? null,
    studying: false,
    cameraEnabled: false,
    timerStartedAt: null,
    accumulatedSeconds: 0,
    joinedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  }
}

function publicRoomData(id, room) {
  return {
    id,
    title: room.title,
    isPrivate: room.isPrivate,
    code: room.code ?? null,
    capacity: room.capacity,
    currentUsers: room.currentUsers,
    ownerId: room.ownerId,
    memberIds: room.memberIds,
    memberNames: room.memberNames,
    status: room.status,
  }
}

async function removeMember(roomRef, userId) {
  const memberRef = roomRef.collection('members').doc(userId)
  let deletedRoom = false
  let inviteCode = null

  await db.runTransaction(async (transaction) => {
    const [roomSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(memberRef),
    ])
    if (!roomSnapshot.exists || !memberSnapshot.exists) return

    const room = roomSnapshot.data()
    const remainingIds = (room.memberIds ?? []).filter((id) => id !== userId)
    transaction.delete(memberRef)

    if (remainingIds.length === 0) {
      deletedRoom = true
      inviteCode = room.code ?? null
      transaction.delete(roomRef)
      return
    }

    const nextNames = { ...(room.memberNames ?? {}) }
    delete nextNames[userId]
    transaction.update(roomRef, {
      memberIds: remainingIds,
      memberNames: nextNames,
      currentUsers: remainingIds.length,
      ownerId: room.ownerId === userId ? remainingIds[0] : room.ownerId,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  if (deletedRoom) {
    if (inviteCode) {
      await db.collection('roomInvites').doc(hashInviteCode(inviteCode)).delete().catch(() => {})
    }
    await db.recursiveDelete(roomRef)
  }

  return deletedRoom
}

export const upsertProfile = onCall(async (request) => {
  const auth = requireUser(request)
  let nickname
  try {
    nickname = getNickname(request, auth)
  } catch (error) {
    throw validationError(error)
  }

  const userRef = db.collection('users').doc(auth.uid)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)
    const profile = {
      nickname,
      photoURL: auth.token.picture ?? null,
      provider: auth.token.firebase?.sign_in_provider ?? 'custom',
      updatedAt: FieldValue.serverTimestamp(),
    }
    transaction.set(
      userRef,
      snapshot.exists ? profile : { ...profile, createdAt: FieldValue.serverTimestamp() },
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
    nickname = getNickname(request, auth)
  } catch (error) {
    throw validationError(error)
  }

  const roomRef = db.collection('rooms').doc()
  const inviteCode = input.isPrivate ? createInviteCode() : null
  const inviteRef = inviteCode
    ? db.collection('roomInvites').doc(hashInviteCode(inviteCode))
    : null

  await db.runTransaction(async (transaction) => {
    if (inviteRef) {
      const existingInvite = await transaction.get(inviteRef)
      if (existingInvite.exists) {
        throw new HttpsError('aborted', '초대 코드가 충돌했습니다. 다시 시도해 주세요.')
      }
    }

    transaction.create(roomRef, {
      title: input.title,
      isPrivate: input.isPrivate,
      code: inviteCode,
      capacity: input.capacity,
      currentUsers: 1,
      ownerId: auth.uid,
      memberIds: [auth.uid],
      memberNames: { [auth.uid]: nickname },
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.create(roomRef.collection('members').doc(auth.uid), memberData(auth, nickname))
    if (inviteRef) {
      transaction.create(inviteRef, { roomId: roomRef.id, createdAt: FieldValue.serverTimestamp() })
    }
  })

  return {
    room: {
      id: roomRef.id,
      ...input,
      code: inviteCode,
      currentUsers: 1,
      ownerId: auth.uid,
      memberIds: [auth.uid],
      memberNames: { [auth.uid]: nickname },
      status: 'open',
    },
  }
})

export const joinRoom = onCall(async (request) => {
  const auth = requireUser(request)
  let nickname
  try {
    nickname = getNickname(request, auth)
  } catch (error) {
    throw validationError(error)
  }

  let roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : ''
  let inviteCode = null
  if (request.data?.inviteCode != null) {
    try {
      inviteCode = normalizeInviteCode(request.data.inviteCode)
    } catch (error) {
      throw validationError(error)
    }
    const invite = await db.collection('roomInvites').doc(hashInviteCode(inviteCode)).get()
    if (!invite.exists) throw new HttpsError('not-found', '유효하지 않은 초대 코드입니다.')
    roomId = invite.data().roomId
  }
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId 또는 inviteCode가 필요합니다.')

  const roomRef = db.collection('rooms').doc(roomId)
  const memberRef = roomRef.collection('members').doc(auth.uid)

  await db.runTransaction(async (transaction) => {
    const [roomSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(memberRef),
    ])
    if (!roomSnapshot.exists) throw new HttpsError('not-found', '존재하지 않는 방입니다.')

    const room = roomSnapshot.data()
    if (room.status !== 'open') throw new HttpsError('failed-precondition', '이미 종료된 방입니다.')
    if (room.isPrivate && !memberSnapshot.exists && inviteCode !== room.code) {
      throw new HttpsError('permission-denied', '비공개방 초대 코드가 필요합니다.')
    }
    if (memberSnapshot.exists) {
      transaction.update(memberRef, { lastSeenAt: FieldValue.serverTimestamp() })
      return
    }
    if ((room.currentUsers ?? room.memberIds?.length ?? 0) >= room.capacity) {
      throw new HttpsError('resource-exhausted', '방 정원이 가득 찼습니다.')
    }

    transaction.create(memberRef, memberData(auth, nickname))
    transaction.update(roomRef, {
      memberIds: FieldValue.arrayUnion(auth.uid),
      [`memberNames.${auth.uid}`]: nickname,
      currentUsers: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  const roomSnapshot = await roomRef.get()
  return { room: publicRoomData(roomSnapshot.id, roomSnapshot.data()) }
})

export const updateMemberStatus = onCall(async (request) => {
  const auth = requireUser(request)
  const roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : ''
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요합니다.')

  const updates = { lastSeenAt: FieldValue.serverTimestamp() }
  if (typeof request.data?.studying === 'boolean') updates.studying = request.data.studying
  if (typeof request.data?.cameraEnabled === 'boolean') updates.cameraEnabled = request.data.cameraEnabled
  if (request.data?.timerStartedAt === null) updates.timerStartedAt = null
  if (request.data?.timerStartedAt === 'now') updates.timerStartedAt = FieldValue.serverTimestamp()
  if (Number.isInteger(request.data?.accumulatedSeconds)
      && request.data.accumulatedSeconds >= 0
      && request.data.accumulatedSeconds <= 31_536_000) {
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
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요합니다.')

  const roomDeleted = await removeMember(db.collection('rooms').doc(roomId), auth.uid)
  return { roomId, roomDeleted }
})

export const cleanupStaleMembers = onSchedule('every 5 minutes', async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 2 * 60 * 1000)
  const staleMembers = await db.collectionGroup('members')
    .where('lastSeenAt', '<', cutoff)
    .limit(100)
    .get()

  await Promise.all(staleMembers.docs.map(async (memberSnapshot) => {
    const roomRef = memberSnapshot.ref.parent.parent
    if (roomRef) await removeMember(roomRef, memberSnapshot.id)
  }))
})
