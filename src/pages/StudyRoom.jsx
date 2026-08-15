import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DEFAULT_ROOM = {
  title: '개발 공부방',
  isPrivate: false,
  capacity: 6,
}

const OTHER_MEMBERS = [
  {
    id: 2,
    nickname: '태영',
    active: true,
    studying: true,
    todos: [
      { id: 201, text: 'JavaScript 복습하기', minutes: 60, done: false },
      { id: 202, text: '알고리즘 문제 풀기', minutes: 90, done: true },
    ],
  },
  {
    id: 3,
    nickname: '민지',
    active: true,
    studying: false,
    todos: [
      { id: 301, text: '영어 단어 외우기', minutes: null, done: false },
      { id: 302, text: '과학 보고서 작성', minutes: 120, done: false },
    ],
  },
]

function formatTimer(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function formatMinutes(minutes) {
  if (minutes == null) return '시간 미설정'
  if (minutes < 60) return `${minutes}분`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`
}

function MemberTodos({ todos }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <p className="mb-2 text-xs font-bold text-slate-500">오늘 할 일</p>
      <div className="space-y-1.5">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-start justify-between gap-2 text-xs">
            <span className={todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}>
              {todo.done ? '✓' : '○'} {todo.text}
            </span>
            <span className="shrink-0 font-medium text-blue-600">{formatMinutes(todo.minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudyRoom() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [settingsOpen, setSettingsOpen] = useState(true)
  const [webcamOn, setWebcamOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [todoInput, setTodoInput] = useState('')
  const [todos, setTodos] = useState([
    { id: 1, text: '수학 공부하기', minutes: null, done: false },
  ])

  const [room] = useState(() => {
    try {
      const savedRoom = sessionStorage.getItem('ondok-selected-room')
      return savedRoom ? JSON.parse(savedRoom) : DEFAULT_ROOM
    } catch {
      return DEFAULT_ROOM
    }
  })

  useEffect(() => {
    if (!running) return undefined

    const interval = window.setInterval(() => {
      setSeconds((previous) => previous + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const startCamera = async () => {
    if (streamRef.current) return

    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setWebcamOn(true)
    } catch (error) {
      console.error('카메라 오류:', error)
      setCameraError('카메라를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.')
      setWebcamOn(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setWebcamOn(false)
  }

  const addTodo = () => {
    const text = todoInput.trim()
    if (!text) return

    setTodos((previous) => [
      ...previous,
      { id: Date.now(), text, minutes: null, done: false },
    ])
    setTodoInput('')
  }

  const toggleTodo = (id) => {
    setTodos((previous) =>
      previous.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    )
  }

  const changeTodoMinutes = (id, amount) => {
    setTodos((previous) =>
      previous.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              minutes:
                amount > 0
                  ? (todo.minutes ?? 0) + 30
                  : todo.minutes === 30
                    ? null
                    : Math.max(30, (todo.minutes ?? 30) - 30),
            }
          : todo,
      ),
    )
  }

  const deleteTodo = (id) => {
    setTodos((previous) => previous.filter((todo) => todo.id !== id))
  }

  const leaveRoom = () => {
    stopCamera()
    setRunning(false)
    navigate('/home')
  }

  const members = [
    { id: 1, nickname: '나', active: true, me: true, studying: running, todos },
    ...OTHER_MEMBERS,
    ...Array.from(
      { length: Math.max(0, room.capacity - OTHER_MEMBERS.length - 1) },
      (_, index) => ({ id: `empty-${index}`, active: false }),
    ),
  ]

  return (
    <div className="app-window">
      <div className="window-panel flex h-full flex-col bg-slate-100 p-5">
        <header className="mb-5 flex shrink-0 items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{room.title}</h1>
              {room.isPrivate && (
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                  비밀방
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>참여 인원 {members.filter((member) => member.active).length} / {room.capacity}</span>
              {room.isPrivate && <span>초대 코드 <strong className="text-slate-700">{room.code}</strong></span>}
            </div>
          </div>
          <button
            type="button"
            onClick={leaveRoom}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            나가기
          </button>
        </header>

        <div className="flex min-h-0 flex-1 gap-5">
          <main className="min-w-0 flex-1 overflow-hidden pr-1">
            <div className="grid h-full grid-cols-3 grid-rows-2 gap-4">
              {members.map((member) => (
                <article key={member.id} className="min-h-0 overflow-y-auto rounded-2xl bg-white shadow-sm">
                  {member.me ? (
                    <div className="relative aspect-video overflow-hidden bg-slate-900">
                      {webcamOn ? (
                        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-center">
                          <div><div className="text-4xl">📷</div><p className="mt-2 text-sm text-slate-400">카메라 OFF</p></div>
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">나</span>
                    </div>
                  ) : member.active ? (
                    <div className="flex aspect-video items-center justify-center bg-slate-800 text-center text-white">
                      <div><div className="text-4xl">👤</div><p className="mt-2 text-sm text-slate-400">상대방 영상</p></div>
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-slate-200 text-center">
                      <div><div className="text-4xl text-slate-400">+</div><p className="mt-2 text-sm text-slate-400">빈 자리</p></div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="font-semibold text-slate-800">{member.active ? member.nickname : '대기 중'}</p>
                    {member.active && (
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${member.studying ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {member.studying ? '공부 중' : '대기 중'}
                      </span>
                    )}
                  </div>
                  {member.active && <MemberTodos todos={member.todos} />}
                </article>
              ))}
            </div>
          </main>

          <div className="relative flex shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label={settingsOpen ? '개인 설정 접기' : '개인 설정 펼치기'}
              aria-expanded={settingsOpen}
              className="absolute right-full top-5 z-10 mr-2 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              {settingsOpen ? '›' : '‹'}
            </button>

            <aside className={`overflow-hidden transition-[width,opacity] duration-300 ${settingsOpen ? 'w-[330px] opacity-100' : 'w-0 opacity-0'}`}>
              <div className="h-full w-[330px] space-y-5 overflow-y-auto pr-1">
                <section className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="mb-5 font-bold text-slate-800">내 공부 타이머</h2>
                  <div className="mb-6 text-center font-mono text-4xl font-bold text-slate-900">{formatTimer(seconds)}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRunning(true)} disabled={running} className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300">시작</button>
                    <button type="button" onClick={() => setRunning(false)} disabled={!running} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">중지</button>
                  </div>
                  <button type="button" onClick={() => { setRunning(false); setSeconds(0) }} className="mt-2 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">초기화</button>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800">웹캠</h2>
                    <span className={`text-xs font-bold ${webcamOn ? 'text-green-600' : 'text-red-500'}`}>{webcamOn ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={startCamera} disabled={webcamOn} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100">ON</button>
                    <button type="button" onClick={stopCamera} disabled={!webcamOn} className="rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-300">OFF</button>
                  </div>
                  {cameraError && <p className="mt-3 text-sm leading-5 text-red-500">{cameraError}</p>}
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="mb-4 font-bold text-slate-800">오늘 할 일</h2>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={todoInput}
                      onChange={(event) => setTodoInput(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') addTodo() }}
                      placeholder="예: 수학 공부하기"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={addTodo} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">추가</button>
                  </div>

                  <div className="space-y-3">
                    {todos.map((todo) => (
                      <div key={todo.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} className="mt-0.5 h-4 w-4" />
                          <span className={`min-w-0 flex-1 break-words text-sm ${todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{todo.text}</span>
                          <button type="button" onClick={() => deleteTodo(todo.id)} className="text-xs font-medium text-red-400 hover:text-red-600">삭제</button>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button type="button" onClick={() => changeTodoMinutes(todo.id, -30)} disabled={todo.minutes == null} aria-label={`${todo.text} 목표 시간 30분 줄이기`} className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300">−</button>
                          <span className="min-w-20 text-center text-xs font-bold text-blue-600">{formatMinutes(todo.minutes)}</span>
                          <button type="button" onClick={() => changeTodoMinutes(todo.id, 30)} aria-label={`${todo.text} 목표 시간 30분 늘리기`} className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">+</button>
                        </div>
                      </div>
                    ))}
                    {todos.length === 0 && <p className="py-5 text-center text-sm text-slate-400">등록된 할 일이 없습니다.</p>}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudyRoom
