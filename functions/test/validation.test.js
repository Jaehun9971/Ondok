import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInviteCode,
  hashInviteCode,
  normalizeInviteCode,
  normalizeNickname,
  normalizeRoomInput,
} from '../src/validation.js'

test('normalizes valid room input using the frontend room contract', () => {
  assert.deepEqual(normalizeRoomInput({ title: '  집중방  ', isPrivate: false, capacity: '6' }), {
    title: '집중방',
    isPrivate: false,
    capacity: 6,
  })
})

test('rejects invalid capacity', () => {
  assert.throws(
    () => normalizeRoomInput({ title: '방', isPrivate: false, capacity: 7 }),
    /invalid-capacity/,
  )
})

test('validates nickname and invite code', () => {
  assert.equal(normalizeNickname('  온독사용자 '), '온독사용자')
  assert.equal(normalizeInviteCode('123456'), '123456')
  assert.throws(() => normalizeInviteCode('12345a'), /invalid-invite-code/)
})

test('creates a six digit invite code and stable non-plain hash', () => {
  const code = createInviteCode()
  assert.match(code, /^\d{6}$/)
  assert.equal(hashInviteCode(code), hashInviteCode(code))
  assert.notEqual(hashInviteCode(code), code)
})
