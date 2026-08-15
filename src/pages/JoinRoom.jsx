import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const testRooms = [
  { id: 4, title: '친구 스터디', currentUsers: 2, capacity: 6, isPrivate: true, code: '123456' },
  { id: 5, title: '팀 프로젝트방', currentUsers: 3, capacity: 6, isPrivate: true, code: '654321' },
]

function JoinRoom() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')

  const handleJoinRoom = () => {
    const code = roomCode.trim()
    if (!code) return setError('초대 코드를 입력해주세요.')

    const savedRoom = sessionStorage.getItem('ondok-selected-room')
    const selectedRoom = savedRoom ? JSON.parse(savedRoom) : null
    const room = testRooms.find((item) => item.code === code)
      ?? (selectedRoom?.code === code ? selectedRoom : null)

    if (!room) return setError('존재하지 않는 초대 코드입니다.')

    sessionStorage.setItem('ondok-selected-room', JSON.stringify(room))
    navigate('/room')
  }

  return (
    <div className="app-window">
      <div className="window-card p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">초대 코드로 입장</h1>
            <p className="mt-1 text-sm text-slate-400">친구에게 받은 6자리 코드를 입력하세요.</p>
          </div>
          <button onClick={() => navigate('/home')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">돌아가기</button>
        </div>
        <input
          value={roomCode}
          onChange={(event) => { setRoomCode(event.target.value.replace(/\D/g, '')); setError('') }}
          onKeyDown={(event) => { if (event.key === 'Enter') handleJoinRoom() }}
          placeholder="예: 123456"
          maxLength={6}
          inputMode="numeric"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
        />
        {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}
        <button onClick={handleJoinRoom} className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">바로 입장하기</button>
        <div className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">테스트 초대 코드: 123456 또는 654321</div>
      </div>
    </div>
  )
}

export default JoinRoom