import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'

import { auth, googleProvider } from '../firebase'

function Login() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError('')

      const result = await signInWithPopup(
        auth,
        googleProvider
      )

      console.log('로그인 사용자:', result.user)

      navigate('/home')
    } catch (error) {
      console.error(error)

      setError('Google 로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleNaverLogin = () => {
    // 백엔드에서 구현할 네이버 OAuth 시작 주소
    window.location.href =
      'http://localhost:8080/api/auth/naver'
  }

  return (
    <div className="app-window">
      <div className="window-card px-6 py-8 sm:px-8">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">📚</div>

          <h1 className="text-4xl font-bold text-slate-900">온독</h1>

          <p className="mt-3 text-sm text-slate-500">
            혼자 공부해도, 함께 집중하는 온라인 독서실
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-center text-xl font-semibold text-slate-900">
            로그인
          </h2>

          <p className="mt-2 text-center text-sm text-slate-500">
            소셜 계정으로 간편하게 시작하세요.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="font-bold text-blue-500">G</span>

              {loading ? '로그인 중...' : 'Google로 계속하기'}
            </button>

            <button
              type="button"
              onClick={handleNaverLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#03C75A] px-4 py-3 font-medium text-white transition hover:brightness-95"
            >
              <span className="font-bold">N</span>

              네이버로 계속하기
            </button>
          </div>

          {error && (
            <p className="mt-4 text-center text-sm text-red-500">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 온독</p>
      </div>
    </div>
  )
}

export default Login