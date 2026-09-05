import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { findRoomByCode, joinRoom, saveSelectedRoom } from '../services/rooms'

function JoinRoom() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoinRoom = async () => {
    const code = roomCode.trim()
    if (code.length !== 6) return setError('6자리 초대 코드를 입력해주세요.')
    if (!auth.currentUser) return setError('로그인이 필요합니다.')
    try {
      setLoading(true)
      const room = await findRoomByCode(code)
      if (!room) return setError('존재하지 않는 초대 코드입니다.')
      await joinRoom(room.id, auth.currentUser)
      saveSelectedRoom(room)
      navigate('/room')
    } catch (err) { setError(err.message || '방에 입장하지 못했습니다.') }
    finally { setLoading(false) }
  }

  return <div className="app-window"><div className="window-card p-8">
    <div className="mb-8 flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">초대 코드로 입장</h1><p className="mt-1 text-sm text-slate-400">친구에게 받은 6자리 코드를 입력하세요.</p></div><button onClick={() => navigate('/home')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">돌아가기</button></div>
    <input value={roomCode} onChange={(e) => { setRoomCode(e.target.value.replace(/\D/g, '')); setError('') }} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()} placeholder="6자리 초대 코드" maxLength={6} inputMode="numeric" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
    {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}
    <button onClick={handleJoinRoom} disabled={loading} className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:bg-blue-300">{loading ? '입장 중...' : '바로 입장하기'}</button>
  </div></div>
}
export default JoinRoom
