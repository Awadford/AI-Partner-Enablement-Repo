import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function SetPassword() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    // Check for error in URL hash (e.g. expired/already-used token)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const desc = params.get('error_description')
      if (desc?.includes('expired') || desc?.includes('invalid')) {
        setExpired(true)
        return
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Password set — navigate based on role
    const destination = profile?.is_admin || profile?.is_pdm ? '/admin' : '/dashboard'
    navigate(destination, { replace: true })
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-pendo-navy flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-pendo-pink flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-4xl mb-3">⏱</div>
            <h2 className="text-lg font-bold text-pendo-navy mb-2">Invite link expired</h2>
            <p className="text-sm text-gray-500 mb-4">
              This link has already been used or expired. Ask your Pendo admin to generate a new invite link for you.
            </p>
            <a
              href="/login"
              className="block w-full py-2.5 bg-pendo-pink text-white rounded-lg font-semibold text-sm hover:bg-pendo-pink-dark transition-colors text-center"
            >
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-pendo-navy flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pendo-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-pendo-pink flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Set your password</h1>
          <p className="text-gray-400 text-sm mt-1">Choose a password to sign in next time</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-pendo-pink text-white rounded-lg font-semibold text-sm hover:bg-pendo-pink-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
