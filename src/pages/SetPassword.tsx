import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase fires an auth state change with type 'SIGNED_IN' when the invite
  // token in the URL hash is exchanged for a session. Wait for that before
  // allowing the user to set their password.
  useEffect(() => {
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

    // Password set — navigate to dashboard (role-based redirect will happen there)
    navigate('/dashboard', { replace: true })
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
