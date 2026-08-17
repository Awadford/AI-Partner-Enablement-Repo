import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const searchParams = new URLSearchParams(useLocation().search)
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(searchParams.get('signup') === 'true' ? 'signup' : 'login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!authLoading && user && profile) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname
      if (profile.is_admin) {
        navigate(from ?? '/admin', { replace: true })
      } else {
        navigate(from ?? '/dashboard', { replace: true })
      }
    }
  }, [user, profile, authLoading, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'reset') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://ai-partner-enablement-repo.vercel.app/set-password',
      })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Check your email for a password reset link.')
      }
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
        setLoading(false)
      }
      // navigation handled by useEffect
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Check your email to confirm your account, then log in.')
      }
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pendo-navy to-pendo-navy-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pendo-pink mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Partner Enablement Portal</h1>
          <p className="text-gray-300 mt-1 text-sm">Pendo Partner Learning Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); setMessage(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'login' ? 'bg-white shadow-sm text-pendo-navy' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'signup' ? 'bg-white shadow-sm text-pendo-navy' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Create Account
            </button>
          </div>

          {mode === 'reset' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">Enter your email and we'll send you a link to reset your password.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none text-sm"
                  placeholder="you@company.com"
                  required
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
              {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>}
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-pendo-pink text-white rounded-lg font-semibold hover:bg-pendo-pink-dark transition-colors disabled:opacity-60">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(null); setMessage(null) }} className="w-full text-sm text-gray-500 hover:text-pendo-navy transition-colors">
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none text-sm"
                  placeholder="Jane Smith"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none text-sm"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none text-sm"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-pendo-pink text-white rounded-lg font-semibold hover:bg-pendo-pink-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(null); setMessage(null) }}
                className="w-full text-sm text-gray-400 hover:text-pendo-navy transition-colors"
              >
                Forgot password?
              </button>
            )}
          </form>
          )}
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          © {new Date().getFullYear()} Pendo.io — Partner Enablement
        </p>
      </div>
    </div>
  )
}
