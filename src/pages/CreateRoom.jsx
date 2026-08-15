import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function CreateRoom() {
  const navigate = useNavigate()
  const [roomType, setRoomType] = useState('open')
  const [roomName, setRoomName] = useState('')
  const [maxUsers, setMaxUsers] = useState(6)
  const [error, setError] = useState('')

  const handleCreateRoom = () => {
    const title = roomName.trim()
    if (!title) return setError('방 이름을 입력해주세요.')

    const isPrivate = roomType === 'private'
    const room = {
      id: Date.now(), title, isPrivate, currentUsers: 1,
      capacity: Number(maxUsers),
      ...(isPrivate && { code: String(Math.floor(100000 + Math.random() * 900000)) }),
    }
    sessionStorage.setItem('ondok-selected-room', JSON.stringify(room))
    navigate('/room')
  }

  return (
    <div className="app-window">
      <div className="window-card p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">방 만들기</h1>
          <button onClick={() => navigate('/home')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">돌아가기</button>
        </div>
        <div className="space-y-6">
          <div>
            <label className="mb-2 block font-semibold text-slate-700">방 이름</label>
            <input value={roomName} onChange={(event) => { setRoomName(event.target.value); setError('') }} placeholder="방 이름을 입력하세요" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
          </div>
          <div>
            <p className="mb-3 font-semibold text-slate-700">방 종류</p>
            <div className="grid grid-cols-2 gap-3">
              {['open', 'private'].map((type) => (
                <button key={type} type="button" onClick={() => setRoomType(type)} className={`rounded-lg border px-4 py-3 font-medium ${roomType === type ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{type === 'open' ? '오픈 방' : '비밀 방'}</button>
              ))}
            </div>
            {roomType === 'private' && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">생성 후 방 안에서 친구에게 전달할 초대 코드가 발급됩니다.</p>}
          </div>
          <div>
            <label className="mb-2 block font-semibold text-slate-700">최대 인원</label>
            <select value={maxUsers} onChange={(event) => setMaxUsers(event.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500">
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-500">{error}</p>}
          <button onClick={handleCreateRoom} className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">방 만들기</button>
        </div>
      </div>
    </div>
  )
}

export default CreateRoom