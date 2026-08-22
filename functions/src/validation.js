import { createHash, randomInt } from 'node:crypto'

export const ROOM_TYPES = new Set(['open', 'private'])

export function normalizeRoomInput(data = {}) {
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const type = data.type
  const capacity = Number(data.capacity)

  if (title.length < 1 || title.length > 40) {
    throw new Error('invalid-title')
  }
  if (!ROOM_TYPES.has(type)) {
    throw new Error('invalid-room-type')
  }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 6) {
    throw new Error('invalid-capacity')
  }

  return { title, type, capacity }
}

export function normalizeNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : ''
  if (nickname.length < 1 || nickname.length > 20) {
    throw new Error('invalid-nickname')
  }
  return nickname
}

export function normalizeInviteCode(value) {
  const code = typeof value === 'string' ? value.trim() : ''
  if (!/^\d{6}$/.test(code)) {
    throw new Error('invalid-invite-code')
  }
  return code
}

export function createInviteCode() {
  return String(randomInt(100000, 1000000))
}

export function hashInviteCode(code) {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}
