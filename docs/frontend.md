# 프론트엔드 연결 작업

이 문서는 백엔드 보안 구조를 사용하기 위해 프론트 담당자가 수정해야 하는 항목만 정리한다. 현재 백엔드는 프론트의 기존 필드명(`isPrivate`, `currentUsers`, `memberIds`, `memberNames`)을 유지한다.

> 중요: 강화된 `firestore.rules`를 배포하면 현재 `src/services/rooms.js`의 직접 방 쓰기는 거부된다. 아래 Functions 연결을 완료한 뒤 규칙을 배포해야 한다.

## 1. Firebase Functions와 Emulator 연결

`src/firebase.js`에서 `getFunctions`를 초기화하고 개발 모드일 때 Emulator를 연결한다.

필요한 API:

```js
getFunctions(app, 'asia-northeast3')
connectAuthEmulator(auth, 'http://127.0.0.1:9099')
connectFirestoreEmulator(db, '127.0.0.1', 8080)
connectFunctionsEmulator(functions, '127.0.0.1', 5001)
```

Emulator 연결은 `import.meta.env.DEV`와 별도의 `VITE_USE_FIREBASE_EMULATOR` 환경변수로 제어하고 한 번만 실행해야 한다.

## 2. `src/services/rooms.js` 교체

다음 직접 Firestore 쓰기를 제거한다.

- `addDoc(roomsRef, room)`
- 클라이언트에서 만드는 6자리 초대 코드
- `runTransaction` 기반 `joinRoom`
- `runTransaction` 기반 `leaveRoom`
- `where('code', '==', code)` 검색

대신 `httpsCallable`로 다음 함수를 호출한다.

```js
createRoom({ title, isPrivate, capacity, nickname })
joinRoom({ roomId, nickname })
joinRoom({ inviteCode, nickname })
leaveRoom({ roomId })
updateMemberStatus({ roomId, ...status })
upsertProfile({ nickname })
```

`createRoom`과 `joinRoom`의 응답은 `result.data.room`이다. 기존 `saveSelectedRoom(room)`에는 이 객체를 그대로 전달할 수 있다.

## 3. 로그인과 보호된 경로

- Google 로그인 성공 직후 `upsertProfile`을 호출한다.
- `/home`, `/create-room`, `/join-room`, `/room`을 공통 인증 가드로 보호한다.
- 인증 초기 상태를 확인하는 동안 로딩 화면을 표시한다.
- 로그아웃 버튼과 `signOut(auth)` 처리를 추가한다.
- 네이버 OAuth 서버가 준비되기 전까지 네이버 버튼은 숨기거나 준비 중 상태로 표시한다.

## 4. 홈 화면

공개방 쿼리는 다음 조건을 사용한다.

```js
where('isPrivate', '==', false)
where('status', '==', 'open')
orderBy('createdAt', 'desc')
```

참여 중인 비공개방은 기존처럼 다음 쿼리를 사용할 수 있다.

```js
where('memberIds', 'array-contains', user.uid)
```

초대 코드 입력은 Firestore의 `code` 필드를 검색하지 말고 `joinRoom({ inviteCode })`만 호출한다.

닉네임 입력은 `defaultValue`가 아니라 상태로 관리하고 `upsertProfile`로 저장한다.

## 5. 스터디룸과 접속 상태

- 방 문서의 `memberIds`, `memberNames`, `currentUsers`는 기존 UI에서 그대로 사용할 수 있다.
- 참여자의 공부 상태·카메라 상태·타이머는 `rooms/{roomId}/members`를 실시간 구독한다.
- 방에 머무는 동안 30초마다 `updateMemberStatus({ roomId })`를 호출해 heartbeat를 갱신한다.
- 타이머 시작·중지와 카메라 ON/OFF 때 `updateMemberStatus`를 즉시 호출한다.
- 정상 나가기 버튼에서는 `leaveRoom` 완료 후 `sessionStorage`를 비운다.
- 탭 종료 요청은 보조 신호로만 사용하고 정확한 퇴장은 서버의 stale-member 정리에 맡긴다.

## 6. 할 일 저장

현재 로컬 `useState`인 할 일을 다음 경로에 저장한다.

```text
users/{uid}/todos/{todoId}
```

문서 필드:

```js
{
  text: string,          // 1~200자
  targetMinutes: number | null,
  done: boolean,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

백엔드 규칙은 본인의 할 일만 읽고 쓸 수 있도록 제한되어 있다.

## 7. WebRTC

현재 `rooms/{roomId}/calls` 시그널링 경로는 유지할 수 있다. 보안 규칙이 call의 `participants` 두 명만 문서와 candidate에 접근하도록 제한하므로 최초 offer 생성 시 반드시 `participants`를 함께 기록해야 한다.

외부 네트워크 테스트 전에는 STUN 외에 인증된 TURN 서버 설정을 추가해야 한다. TURN 인증정보를 장기 고정 문자열로 프론트에 넣지 말고 서버에서 단기 자격증명을 발급받는 방식이 필요하다.

## 8. App Check와 환경 설정

- Firebase 설정은 `VITE_FIREBASE_*` 환경변수로 분리한다.
- `.env`에는 JavaScript 코드를 넣지 않는다.
- 루트 프론트 패키지에서 사용하지 않는 서버 전용 의존성 `cors`, `dotenv`, `express`, `express-session`, `firebase-admin`을 제거한다. 서버 의존성은 `functions/package.json`에서만 관리한다.
- 운영 도메인을 Firebase Authentication 승인 도메인에 등록한다.
- App Check를 프론트에 초기화한 후 모니터링하고 Firestore/Functions enforcement를 활성화한다.

## 완료 확인 시나리오

1. Emulator에서 사용자 A와 B 생성
2. A가 공개방 생성
3. B가 공개방 입장
4. 두 화면의 인원이 `2 / capacity`로 동일하게 표시
5. 양쪽 공부 상태·타이머·카메라 상태가 실시간 반영
6. B의 탭을 강제 종료하고 2~7분 안에 인원이 1명으로 복구
7. 비회원의 방 접근과 비참여자의 비공개방 읽기가 거부
8. 초대 코드 없이는 비공개방 입장이 거부
9. 서로 다른 외부 네트워크에서 영상 연결 확인
