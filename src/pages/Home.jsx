import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../firebase'
import { findRoomByCode, joinRoom, saveSelectedRoom } from '../services/rooms'

function Home() {
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [openRooms, setOpenRooms] = useState([])
  const [privateRooms, setPrivateRooms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeOpen = () => {}
    let unsubscribePrivate = () => {}
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { navigate('/login'); return }
      unsubscribeOpen = onSnapshot(query(collection(db, 'rooms'), where('isPrivate', '==', false)), (result) => {
      setOpenRooms(result.docs.map((item) => ({ id: item.id, ...item.data() })))
      setLoading(false)
      })
      unsubscribePrivate = onSnapshot(query(collection(db, 'rooms'), where('memberIds', 'array-contains', user.uid)), (result) => {
        setPrivateRooms(result.docs.map((item) => ({ id: item.id, ...item.data() })).filter((room) => room.isPrivate))
      })
    })
    return () => { unsubscribeAuth(); unsubscribeOpen(); unsubscribePrivate() }
  }, [navigate])

  const selectRoom = async (room) => {
    try {
      await joinRoom(room.id, auth.currentUser)
      saveSelectedRoom(room)
      navigate('/room')
    } catch (error) { setInviteError(error.message) }
  }

  const joinWithInviteCode = async () => {
    const code = inviteCode.trim()

    if (!code) {
      setInviteError('방 코드를 입력해주세요.')
      return
    }

    try {
      const room = await findRoomByCode(code)
      if (!room) return setInviteError('존재하지 않는 방 코드입니다.')
      await joinRoom(room.id, auth.currentUser)
      saveSelectedRoom(room)
      navigate('/room')
    } catch (error) { setInviteError(error.message) }
  }

  const renderRooms = (rooms) => (
    <div className="space-y-4">
      {rooms.map((room) => (
        <button key={room.id} type="button" onClick={() => selectRoom(room)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{room.isPrivate && '🔒 '}{room.title}</p>
            <span className="text-sm text-slate-400">{room.currentUsers} / {room.capacity}</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">클릭하여 바로 입장</p>
        </button>
      ))}
    </div>
  )

  return (
    <div className="app-window">
      <div className="window-panel mx-auto flex overflow-hidden">
        <section className={`border-r border-slate-200 p-8 transition-all duration-300 ${settingsOpen ? 'w-[34%]' : 'w-1/2'}`}>
          <h2 className="mb-8 text-center text-xl font-bold text-slate-800">오픈 방</h2>
          {loading ? <p className="text-center text-sm text-slate-400">불러오는 중...</p> : openRooms.length ? renderRooms(openRooms) : <p className="text-center text-sm text-slate-400">생성된 오픈 방이 없습니다.</p>}
        </section>

        <section className={`border-r border-slate-200 p-8 transition-all duration-300 ${settingsOpen ? 'w-[34%]' : 'flex-1'}`}>
          <h2 className="mb-8 text-center text-xl font-bold text-slate-800">비밀 방</h2>
          {privateRooms.length ? renderRooms(privateRooms) : <p className="text-center text-sm text-slate-400">참여 중인 비밀 방이 없습니다.</p>}
        </section>

        <button type="button" onClick={() => setSettingsOpen((previous) => !previous)} aria-label={settingsOpen ? '개인 설정 접기' : '개인 설정 펼치기'} className="flex w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-2xl font-bold text-slate-500 transition hover:bg-slate-100">
          {settingsOpen ? '›' : '‹'}
        </button>

        <aside className={`overflow-hidden transition-all duration-300 ${settingsOpen ? 'w-[32%] p-8' : 'w-0 p-0'}`}>
          <div className="min-w-[260px]">
            <h2 className="mb-8 text-xl font-bold text-slate-800">개인 설정</h2>
            <div className="space-y-7">
              <div>
                <label className="mb-2 block font-semibold text-slate-700">닉네임</label>
                <input type="text" defaultValue="온독사용자" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
              </div>
              <div>
                <p className="mb-3 font-semibold text-slate-700">새 스터디</p>
                <button type="button" onClick={() => navigate('/create-room')} className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700">방 만들기</button>
              </div>
              <div>
                <p className="mb-3 font-semibold text-slate-700">초대 코드</p>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => {
                    setInviteCode(event.target.value)
                    setInviteError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') joinWithInviteCode()
                  }}
                  placeholder="방 코드를 입력하세요"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
                {inviteError && <p className="mt-2 text-sm text-red-500">{inviteError}</p>}
                <button type="button" onClick={joinWithInviteCode} className="mt-3 w-full rounded-lg border border-slate-300 py-3 font-medium hover:bg-slate-50">코드로 바로 입장</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Home
