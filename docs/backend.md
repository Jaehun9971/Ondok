# 온독 백엔드 구조

백엔드는 현재 프론트에서 사용하는 방 데이터 형식을 기준으로 구성한다. 방 생성, 입장, 퇴장과 접속 인원 변경은 Cloud Functions만 수행하며 클라이언트의 직접 쓰기는 Firestore Security Rules에서 차단한다.

## 방 데이터 계약

```text
rooms/{roomId}
  title: string
  isPrivate: boolean
  code: string | null
  capacity: number
  currentUsers: number
  ownerId: uid
  memberIds: uid[]
  memberNames: { [uid]: nickname }
  status: "open"
  createdAt: timestamp
  updatedAt: timestamp

rooms/{roomId}/members/{uid}
  uid: string
  nickname: string
  photoURL: string | null
  studying: boolean
  cameraEnabled: boolean
  timerStartedAt: timestamp | null
  accumulatedSeconds: number
  joinedAt: timestamp
  lastSeenAt: timestamp
```

`memberIds`, `memberNames`, `currentUsers`는 기존 프론트 화면과 호환되는 요약 필드다. 세부 접속 상태와 heartbeat는 `members` 하위 컬렉션에 저장한다.

## Callable Functions

모든 Callable Function은 Firebase 로그인이 필요하다.

### `upsertProfile`

```js
{ nickname: '온독사용자' }
```

### `createRoom`

```js
{
  title: '개발 공부방',
  isPrivate: true,
  capacity: 6,
  nickname: '온독사용자'
}
```

응답:

```js
{ room: { id, title, isPrivate, code, capacity, currentUsers, ownerId, memberIds, memberNames, status } }
```

### `joinRoom`

```js
// 공개방
{ roomId: 'room-id', nickname: '온독사용자' }

// 비공개방
{ inviteCode: '123456', nickname: '온독사용자' }
```

응답은 `{ room }`이다. 비공개방 코드는 서버의 해시 매핑으로 찾으며 정원 검사는 transaction 안에서 처리한다.

### `updateMemberStatus`

```js
{
  roomId: 'room-id',
  studying: true,
  cameraEnabled: false,
  timerStartedAt: 'now', // 중지할 때 null
  accumulatedSeconds: 120
}
```

이 함수는 heartbeat 역할도 하므로 스터디룸에 머무는 동안 30초 간격으로 호출한다.

### `leaveRoom`

```js
{ roomId: 'room-id' }
```

남은 사용자가 없으면 방과 초대 코드 매핑을 삭제한다. 방장이 먼저 나가면 남은 참여자 중 첫 번째 사용자에게 방장을 이전한다.

### `cleanupStaleMembers`

5분마다 실행되는 예약 함수다. `lastSeenAt`이 2분 이상 갱신되지 않은 사용자를 방에서 제거하고 `currentUsers`를 복구한다.

## 보안 정책

- 공개방: 로그인 사용자만 읽기 가능
- 비공개방: 참여자만 읽기 가능
- 방 생성·수정·삭제: Admin SDK/Functions 전용
- 참여자 상태 쓰기: Functions 전용
- 개인 프로필과 할 일: 본인만 접근 가능
- WebRTC call: 같은 방의 해당 두 참여자만 접근 가능
- 초대 코드 해시 매핑: Admin SDK 전용

## 로컬 검사

```powershell
cd functions
npm install
npm run check
npm test
cd ..
$env:FUNCTIONS_DISCOVERY_TIMEOUT='30'
npx firebase-tools emulators:start
```

Windows에서 Functions 탐색이 10초 안에 끝나지 않는 경우를 고려해 로컬 실행 시 탐색 제한을 30초로 설정한다. `firebase.json`은 예약 함수 테스트를 위한 Pub/Sub Emulator도 함께 실행한다.

## 배포

예약 함수와 Functions 배포에는 Firebase 프로젝트의 결제 설정이 필요할 수 있다. 프론트 통합이 끝난 뒤 배포한다.

```powershell
npm run build
npx firebase-tools deploy --only firestore,functions,hosting
```

`firebase.json`에는 Vite의 `dist`를 배포하고 React Router 요청을 `index.html`로 보내는 Hosting 설정이 포함되어 있다.
