import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { LmsProfile } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: LmsProfile | null
  isAdmin: boolean
  loading: boolean
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<LmsProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchOrCreateProfile(u: User): Promise<LmsProfile | null> {
    // Try to fetch existing profile
    const { data: existing, error: fetchError } = await supabase
      .from('lms_profiles')
      .select('*')
      .eq('id', u.id)
      .single()

    if (existing && !fetchError) {
      return existing as LmsProfile
    }

    // Profile doesn't exist — create one
    const email = u.email ?? ''
    const ADMIN_EMAILS = ['andrew.wadford@pendo.io', 'gabrielle.vacca@pendo.io']
    const isAdmin = ADMIN_EMAILS.includes(email)

    // Find partner by email domain
    let partnerId: string | null = null
    if (!isAdmin) {
      const domain = email.split('@')[1] ?? ''
      if (domain) {
        const { data: domainRow } = await supabase
          .from('lms_partner_domains')
          .select('partner_id')
          .eq('domain', domain)
          .single()
        partnerId = domainRow?.partner_id ?? null
      }
    }

    const newProfile: Omit<LmsProfile, 'created_at' | 'updated_at'> = {
      id: u.id,
      email,
      full_name: u.user_metadata?.full_name ?? null,
      title: null,
      partner_id: partnerId,
      is_admin: isAdmin,
    }

    const { data: created, error: createError } = await supabase
      .from('lms_profiles')
      .insert([newProfile])
      .select()
      .single()

    if (createError) {
      // Row may already exist (e.g. manually inserted) — re-fetch it
      if (createError.code === '23505') {
        const { data: refetched } = await supabase
          .from('lms_profiles')
          .select('*')
          .eq('id', u.id)
          .single()
        return refetched as LmsProfile | null
      }
      console.error('Error creating profile:', createError)
      return null
    }

    return created as LmsProfile
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user) {
        const p = await fetchOrCreateProfile(s.user)
        if (mounted) setProfile(p)
      }

      setLoading(false)
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user) {
        const p = await fetchOrCreateProfile(s.user)
        if (mounted) setProfile(p)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    session,
    profile,
    isAdmin: profile?.is_admin ?? false,
    loading,
  }
}
