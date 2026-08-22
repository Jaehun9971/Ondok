# 온독 Firebase 백엔드

기존 React 소스와 분리된 Firebase 백엔드입니다. 방과 참여자에 대한 쓰기는 Cloud Functions만 수행하며, 클라이언트는 허용된 데이터만 Firestore에서 실시간 구독합니다.

## 구성과 컬렉션

- Firebase Authentication: Google 로그인 및 향후 Naver Custom Token 로그인
- Cloud Firestore: 사용자, 할 일, 방, 참여자 상태
- Cloud Functions (`asia-northeast3`): 방 생성, 입장, 퇴장과 상태 검증
- Firebase Emulator Suite: 로컬 Auth, Firestore, Functions 테스트

```text
users/{uid}
users/{uid}/todos/{todoId}
rooms/{roomId}
rooms/{roomId}/members/{uid}
roomInvites/{sha256(inviteCode)}   # 서버 전용
```

`roomInvites`에는 초대 코드 원문을 저장하지 않으며 Security Rules가 클라이언트 접근을 모두 거부합니다.

## Callable API

모든 함수는 로그인된 Firebase 사용자를 요구합니다.

```js
// 사용자 프로필 생성 또는 갱신
upsertProfile({ nickname: '온독사용자' })

// 방 생성. private일 때만 inviteCode가 반환된다.
createRoom({
  title: '개발 공부방',
  type: 'private',
  capacity: 6,
  nickname: '온독사용자',
}) // => { roomId, inviteCode }

// 공개방 또는 비공개방 입장
joinRoom({ roomId: 'firestore-room-id', nickname: '온독사용자' })
joinRoom({ inviteCode: '123456', nickname: '온독사용자' })

// 참여자 상태와 서버 기준 타이머 갱신
updateMemberStatus({
  roomId: 'firestore-room-id',
  studying: true,
  cameraEnabled: false,
  timerStartedAt: 'now',
  accumulatedSeconds: 0,
})

// 방 퇴장. 방장이 나가면 방을 닫는다.
leaveRoom({ roomId: 'firestore-room-id' })
```

타이머를 멈출 때 `timerStartedAt: null`과 계산한 누적 초를 전달합니다.

## 로컬 실행

```powershell
npx firebase-tools login
cd functions
npm install
npm test
cd ..
npx firebase-tools emulators:start
```

Emulator UI는 `http://localhost:4000`에서 확인할 수 있습니다.

## 배포

Firebase Console에서 Firestore 데이터베이스를 먼저 생성한 뒤 실행합니다.

```powershell
npx firebase-tools login
npx firebase-tools use ondok-6d0f5
npx firebase-tools deploy --only firestore,functions
```

배포 전에 Firebase 프로젝트의 요금제와 Cloud Functions 사용 가능 여부를 확인해야 합니다.

## 이후 프론트 연결 지점

- `Home.jsx`: 공개방 `rooms` 쿼리 구독
- `CreateRoom.jsx`: `createRoom` 호출
- `JoinRoom.jsx`: `joinRoom` 호출
- `StudyRoom.jsx`: `rooms/{roomId}/members` 구독 및 상태 함수 호출
- 개인 할 일: `users/{uid}/todos` 읽기와 쓰기

현재 요청에 따라 기존 `src` 파일은 변경하지 않았습니다.
