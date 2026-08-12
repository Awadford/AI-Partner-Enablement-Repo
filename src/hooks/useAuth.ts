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
    const ADMIN_EMAILS = ['andrew.wadford@pendo.io', 'gabrielle.vacca@pendo.io', 'adam.goings@pendo.io']
    const isAdmin = ADMIN_EMAILS.includes(email)

    // Find partner by email domain or pending registration
    let partnerId: string | null = null
    type PendingRec = { id: string; partner_id: string; full_name: string | null; certifications: string[] }
    let pendingRecord: PendingRec | null = null
    if (!isAdmin) {
      // 1. Check domain mapping
      const domain = email.split('@')[1] ?? ''
      if (domain) {
        const { data: domainRow } = await supabase
          .from('lms_partner_domains')
          .select('partner_id')
          .eq('domain', domain)
          .single()
        partnerId = domainRow?.partner_id ?? null
      }
      // 2. Check pending registrations (admin pre-registered this email)
      if (!partnerId) {
        const { data: pending } = await supabase
          .from('lms_pending_registrations')
          .select('id, partner_id, full_name, certifications')
          .eq('email', email)
          .single()
        if (pending?.partner_id) {
          partnerId = pending.partner_id
          pendingRecord = pending as unknown as PendingRec
        }
      }
    }

    const newProfile: Omit<LmsProfile, 'created_at' | 'updated_at'> = {
      id: u.id,
      email,
      full_name: u.user_metadata?.full_name ?? (pendingRecord?.full_name ?? null),
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

    // If they came from a pending registration, auto-complete delivery modules + transfer certs
    if (created && pendingRecord && partnerId) {
      // 1. Mark all enabled delivery modules as completed
      const { data: pmRows } = await supabase
        .from('lms_partner_modules')
        .select('module_id, lms_modules(category)')
        .eq('partner_id', partnerId)
        .eq('enabled', true)

      const deliveryModuleIds = ((pmRows ?? []) as any[])
        .filter(pm => pm.lms_modules?.category === 'delivery')
        .map(pm => pm.module_id as string)

      if (deliveryModuleIds.length > 0) {
        const now = new Date().toISOString()
        await supabase.from('lms_user_progress').insert(
          deliveryModuleIds.map(moduleId => ({
            user_id: created.id,
            module_id: moduleId,
            status: 'completed',
            started_at: now,
            completed_at: now,
          }))
        )
      }

      // 2. Transfer any pre-loaded certifications by matching cert names
      const certNames: string[] = pendingRecord.certifications ?? []
      if (certNames.length > 0) {
        const { data: allCerts } = await supabase.from('lms_certifications').select('id, title')
        const certMap = Object.fromEntries(
          ((allCerts ?? []) as { id: string; title: string }[]).map(c => [c.title.toLowerCase(), c.id])
        )
        const certInserts = certNames
          .map(name => certMap[name.toLowerCase()])
          .filter(Boolean)
          .map(certId => ({ user_id: created.id, certification_id: certId }))
        if (certInserts.length > 0) {
          await supabase.from('lms_user_certifications').insert(certInserts)
        }
      }

      // 3. Remove the pending registration
      await supabase.from('lms_pending_registrations').delete().eq('id', pendingRecord.id)
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
