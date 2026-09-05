import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { createRoom, saveSelectedRoom } from '../services/rooms'

function CreateRoom() {
  const navigate = useNavigate()
  const [roomType, setRoomType] = useState('open')
  const [roomName, setRoomName] = useState('')
  const [maxUsers, setMaxUsers] = useState(6)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateRoom = async () => {
    const title = roomName.trim()
    if (!title) return setError('방 이름을 입력해주세요.')
    if (!auth.currentUser) return setError('로그인이 필요합니다.')
    try {
      setLoading(true)
      const room = await createRoom({ title, isPrivate: roomType === 'private', capacity: Number(maxUsers), user: auth.currentUser })
      saveSelectedRoom(room)
      navigate('/room')
    } catch (err) {
      console.error(err)
      setError('방을 만들지 못했습니다. Firestore 설정을 확인해주세요.')
    } finally { setLoading(false) }
  }

  return <div className="app-window"><div className="window-card p-8">
    <div className="mb-8 flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-900">방 만들기</h1><button onClick={() => navigate('/home')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">돌아가기</button></div>
    <div className="space-y-6">
      <div><label className="mb-2 block font-semibold text-slate-700">방 이름</label><input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="방 이름을 입력하세요" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" /></div>
      <div><p className="mb-3 font-semibold text-slate-700">방 종류</p><div className="grid grid-cols-2 gap-3">{['open','private'].map((type) => <button key={type} type="button" onClick={() => setRoomType(type)} className={`rounded-lg border px-4 py-3 font-medium ${roomType === type ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700'}`}>{type === 'open' ? '오픈 방' : '비밀 방'}</button>)}</div>{roomType === 'private' && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">방 안에서 공유할 초대 코드가 자동 발급됩니다.</p>}</div>
      <div><label className="mb-2 block font-semibold text-slate-700">최대 인원</label><select value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3">{[2,3,4,5,6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-500">{error}</p>}
      <button onClick={handleCreateRoom} disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:bg-blue-300">{loading ? '만드는 중...' : '방 만들기'}</button>
    </div>
  </div></div>
}
export default CreateRoom
