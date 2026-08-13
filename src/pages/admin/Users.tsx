import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { useAuth } from '../../hooks/useAuth'
import { LmsProfile } from '../../types'

const PORTAL_SIGNUP_URL = 'https://ai-partner-enablement-repo.vercel.app/login'

interface PendingInvite {
  id: string
  email: string
  is_admin: boolean
  is_pdm: boolean
  created_at: string
}

export function AdminUsers() {
  const { profile: currentUser } = useAuth()
  const [users, setUsers] = useState<LmsProfile[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'pdm'>('admin')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [usersRes, invitesRes] = await Promise.all([
      supabase
        .from('lms_profiles')
        .select('*')
        .is('partner_id', null)
        .order('full_name', { ascending: true }),
      supabase
        .from('lms_user_invites')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setUsers((usersRes.data ?? []) as LmsProfile[])
    setInvites((invitesRes.data ?? []) as PendingInvite[])
    setLoading(false)
  }

  async function toggleRole(user: LmsProfile, field: 'is_admin' | 'is_pdm') {
    setSaving(user.id + field)
    const newVal = !user[field]
    const { error } = await supabase
      .from('lms_profiles')
      .update({ [field]: newVal })
      .eq('id', user.id)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, [field]: newVal } : u))
    }
    setSaving(null)
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)

    const { error } = await supabase.from('lms_user_invites').insert({
      email: inviteEmail.toLowerCase().trim(),
      is_admin: inviteRole === 'admin',
      is_pdm: inviteRole === 'pdm',
      invited_by: currentUser?.id ?? null,
    })

    if (error) {
      setInviteError(error.message.includes('unique') ? 'An invite for this email already exists.' : error.message)
    } else {
      setInviteEmail('')
      await load()
    }
    setInviting(false)
  }

  async function removeInvite(id: string) {
    await supabase.from('lms_user_invites').delete().eq('id', id)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  function copySignupLink() {
    navigator.clipboard.writeText(PORTAL_SIGNUP_URL)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-pendo-navy">Internal Pendo Users</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage portal access for the Pendo team.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Invite form */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-pendo-navy mb-4">Invite a Pendo Team Member</h2>
              <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="name@pendo.io"
                  required
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'pdm')}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="pdm">PDM</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-pendo-pink text-white rounded-lg text-sm font-medium hover:bg-pendo-pink-dark transition-colors disabled:opacity-60"
                >
                  {inviting ? 'Adding…' : 'Add Invite'}
                </button>
              </form>
              {inviteError && (
                <p className="text-red-600 text-sm mt-2">{inviteError}</p>
              )}
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                <span>Share the signup link with them:</span>
                <button
                  onClick={copySignupLink}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 hover:border-pendo-pink hover:text-pendo-pink transition-colors text-xs font-medium"
                >
                  {copiedLink ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy link
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-pendo-navy">Pending Invites</h2>
                  <p className="text-xs text-gray-500 mt-0.5">These roles will be applied when the person signs up.</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">{invite.email}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${invite.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {invite.is_admin ? 'Admin' : 'PDM'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeInvite(invite.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove invite"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active users */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-pendo-navy">Active Users</h2>
                <p className="text-xs text-gray-500 mt-0.5">{users.length} internal Pendo accounts</p>
              </div>
              <div className="divide-y divide-gray-100">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-pendo-navy bg-opacity-10 flex items-center justify-center flex-shrink-0">
                        <span className="text-pendo-navy text-xs font-semibold">
                          {(user.full_name ?? user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-pendo-navy truncate">
                          {user.full_name ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {/* Admin toggle */}
                      <button
                        onClick={() => toggleRole(user, 'is_admin')}
                        disabled={saving === user.id + 'is_admin' || user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? "Can't change your own role" : ''}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
                          ${user.is_admin
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {saving === user.id + 'is_admin' ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        )}
                        Admin
                      </button>

                      {/* PDM toggle */}
                      <button
                        onClick={() => toggleRole(user, 'is_pdm')}
                        disabled={saving === user.id + 'is_pdm'}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
                          ${user.is_pdm
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {saving === user.id + 'is_pdm' ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                        PDM
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </Layout>
  )
}
