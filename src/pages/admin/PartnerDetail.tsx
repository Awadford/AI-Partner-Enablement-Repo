import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { Partner, LmsModule, LmsPartnerModule, LmsPartnerDomain, LmsProfile, LmsUserProgress, LmsCertification, LmsUserCertification } from '../../types'

interface ModuleRow extends LmsModule {
  pm: LmsPartnerModule | null
}

interface LearnerRow extends LmsProfile {
  completed: number
  total: number
  earnedCertIds: Set<string>
  moduleProgress: Record<string, 'not_started' | 'in_progress' | 'completed'>
}

interface CertRow extends LmsCertification {
  pcId: string | null  // lms_partner_certifications.id
  enabled: boolean
}

interface PendingRegistration {
  id: string
  email: string
  full_name: string | null
  title: string | null
  certifications: string[]
  created_at: string
}

const PARTNER_TYPES = ['Solution Partner', 'OEM', 'Referral', 'Reseller', 'Services', 'Subcontractor', 'HyperScaler', 'ISV', 'PE Firm', 'Japan Partner', 'Internal Pendo']

// Parse category_type string — handles both ", " and " + " separators (legacy data)
function parseTypes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(/,\s*|\s*\+\s*/).map(t => t.trim()).filter(Boolean)
}

export function AdminPartnerDetail() {
  const { partnerId } = useParams<{ partnerId: string }>()

  const [partner, setPartner] = useState<Partner | null>(null)
  const [editPartner, setEditPartner] = useState<Partial<Partner>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Salesforce account search
  const [sfQuery, setSfQuery] = useState('')
  const [sfResults, setSfResults] = useState<{ sf_id: string; name: string; website: string | null }[]>([])
  const [sfSearchOpen, setSfSearchOpen] = useState(false)

  const [domains, setDomains] = useState<LmsPartnerDomain[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [addingDomain, setAddingDomain] = useState(false)
  const [domainError, setDomainError] = useState<string | null>(null)

  const [modules, setModules] = useState<ModuleRow[]>([])
  const [certifications, setCertifications] = useState<CertRow[]>([])
  const [learners, setLearners] = useState<LearnerRow[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [certFilter, setCertFilter] = useState<string>('all')
  const [showAddLearner, setShowAddLearner] = useState(false)
  const [newLearnerEmail, setNewLearnerEmail] = useState('')
  const [newLearnerName, setNewLearnerName] = useState('')
  const [addingLearner, setAddingLearner] = useState(false)
  const [addLearnerMsg, setAddLearnerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvMsg, setCsvMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [expandedLearnerId, setExpandedLearnerId] = useState<string | null>(null)

  // Inline learner editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowType, setEditingRowType] = useState<'learner' | 'pending' | null>(null)
  const [editDraft, setEditDraft] = useState<{ full_name: string; title: string; email: string }>({ full_name: '', title: '', email: '' })
  const [savingRow, setSavingRow] = useState(false)

  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!partnerId) return

    const [partnerRes, domainsRes, modulesRes, pmRes, profilesRes, progressRes, certsRes, pcRes, ucRes, pendingRes] = await Promise.all([
      supabase.from('partners').select('*').eq('id', partnerId).single(),
      supabase.from('lms_partner_domains').select('*').eq('partner_id', partnerId),
      supabase.from('lms_modules').select('*').order('default_order'),
      supabase.from('lms_partner_modules').select('*').eq('partner_id', partnerId),
      supabase.from('lms_profiles').select('*').eq('partner_id', partnerId).eq('is_admin', false),
      supabase.from('lms_user_progress').select('*'),
      supabase.from('lms_certifications').select('*').order('order_index'),
      supabase.from('lms_partner_certifications').select('*').eq('partner_id', partnerId),
      supabase.from('lms_user_certifications').select('*'),
      supabase.from('lms_pending_registrations').select('*').eq('partner_id', partnerId).order('created_at'),
    ])

    setPendingRegistrations((pendingRes.data ?? []) as PendingRegistration[])

    const p = partnerRes.data as Partner
    setPartner(p)
    setEditPartner({ name: p.name, notes: p.notes ?? '', enbl_stage: p.enbl_stage, pdm: p.pdm ?? '', region: p.region ?? '', category_type: p.category_type ?? '', salesforce_account_id: p.salesforce_account_id ?? '', salesforce_account_name: p.salesforce_account_name ?? '' })
    setDomains((domainsRes.data ?? []) as LmsPartnerDomain[])

    const pmMap: Record<string, LmsPartnerModule> = {}
    for (const pm of (pmRes.data ?? []) as LmsPartnerModule[]) {
      pmMap[pm.module_id] = pm
    }

    const allModules = (modulesRes.data ?? []) as LmsModule[]
    const rows: ModuleRow[] = allModules.map((m, _idx) => ({
      ...m,
      pm: pmMap[m.id] ?? null,
    }))
    // Sort by pm order_index if set, otherwise default_order
    rows.sort((a, b) => {
      const ao = a.pm?.order_index ?? a.default_order
      const bo = b.pm?.order_index ?? b.default_order
      return ao - bo
    })
    setModules(rows)

    const profileList = (profilesRes.data ?? []) as LmsProfile[]
    const progressList = (progressRes.data ?? []) as LmsUserProgress[]
    const enabledModuleCount = rows.filter(r => r.pm?.enabled).length

    const userCertList = (ucRes.data ?? []) as LmsUserCertification[]
    const learnerRows: LearnerRow[] = profileList.map(prof => {
      const userProgress = progressList.filter(pr => pr.user_id === prof.id)
      const moduleProgress: Record<string, 'not_started' | 'in_progress' | 'completed'> = {}
      for (const pr of userProgress) {
        moduleProgress[pr.module_id] = pr.status as 'not_started' | 'in_progress' | 'completed'
      }
      const completed = userProgress.filter(pr => pr.status === 'completed').length
      const earnedCertIds = new Set(
        userCertList.filter(uc => uc.user_id === prof.id).map(uc => uc.certification_id)
      )
      return { ...prof, completed, total: enabledModuleCount, earnedCertIds, moduleProgress }
    })
    setLearners(learnerRows)

    // Build cert rows
    const pcMap: Record<string, { id: string; enabled: boolean }> = {}
    for (const pc of (pcRes.data ?? []) as any[]) {
      pcMap[pc.certification_id] = { id: pc.id, enabled: pc.enabled }
    }
    const certRows: CertRow[] = ((certsRes.data ?? []) as LmsCertification[]).map(c => ({
      ...c,
      pcId: pcMap[c.id]?.id ?? null,
      enabled: pcMap[c.id]?.enabled ?? false,
    }))
    setCertifications(certRows)

    setLoading(false)
  }, [partnerId])

  useEffect(() => { loadData() }, [loadData])

  const savePartner = async () => {
    if (!partnerId) return
    setSaving(true)
    const { error } = await supabase.from('partners').update({
      name: editPartner.name,
      notes: editPartner.notes,
      enbl_stage: editPartner.enbl_stage,
      pdm: editPartner.pdm || null,
      region: editPartner.region || null,
      category_type: editPartner.category_type || null,
      salesforce_account_id: editPartner.salesforce_account_id || null,
      salesforce_account_name: editPartner.salesforce_account_name || null,
    }).eq('id', partnerId)
    setSaving(false)
    if (!error) {
      setSaveMsg('Saved!')
      setPartner(prev => prev ? { ...prev, ...editPartner } as Partner : null)
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  const searchSfAccounts = async (q: string) => {
    setSfQuery(q)
    if (q.trim().length < 2) { setSfResults([]); return }
    const { data } = await supabase
      .from('sf_accounts_cache')
      .select('sf_id, name, website')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(8)
    setSfResults((data ?? []) as { sf_id: string; name: string; website: string | null }[])
  }

  const selectSfAccount = (acc: { sf_id: string; name: string }) => {
    setEditPartner(prev => ({ ...prev, salesforce_account_id: acc.sf_id, salesforce_account_name: acc.name }))
    setSfQuery('')
    setSfResults([])
    setSfSearchOpen(false)
  }

  const addDomain = async () => {
    if (!newDomain.trim() || !partnerId) return
    setAddingDomain(true)
    setDomainError(null)
    const { data, error } = await supabase
      .from('lms_partner_domains')
      .insert([{ partner_id: partnerId, domain: newDomain.trim().toLowerCase() }])
      .select()
      .single()
    if (!error && data) {
      setDomains(prev => [...prev, data as LmsPartnerDomain])
      setNewDomain('')
    } else if (error) {
      setDomainError(error.code === '23505' ? 'That domain is already registered to another partner.' : error.message)
    }
    setAddingDomain(false)
  }

  const deleteDomain = async (id: string) => {
    const { error } = await supabase.from('lms_partner_domains').delete().eq('id', id)
    if (!error) setDomains(prev => prev.filter(d => d.id !== id))
  }

  const addLearner = async () => {
    if (!newLearnerEmail.trim() || !partnerId) return
    setAddingLearner(true)
    setAddLearnerMsg(null)
    const email = newLearnerEmail.trim().toLowerCase()
    const name = newLearnerName.trim() || null

    // Check if they already have a profile
    const { data: existing } = await supabase
      .from('lms_profiles')
      .select('id, partner_id, email, is_admin')
      .eq('email', email)
      .single()

    if (existing) {
      if (existing.is_admin) {
        setAddLearnerMsg({ type: 'error', text: `${email} is an admin account and cannot be added as a learner.` })
        setAddingLearner(false)
        return
      }
      // Already registered — update their partner assignment
      const { error } = await supabase
        .from('lms_profiles')
        .update({ partner_id: partnerId, ...(name ? { full_name: name } : {}) })
        .eq('id', existing.id)
      if (error) {
        setAddLearnerMsg({ type: 'error', text: 'Failed to update learner.' })
      } else {
        setAddLearnerMsg({ type: 'success', text: `${email} assigned to this partner.` })
        setNewLearnerEmail('')
        setNewLearnerName('')
        await loadData()
      }
    } else {
      // Not yet registered — pre-register them
      const { data, error } = await supabase
        .from('lms_pending_registrations')
        .upsert([{ email, partner_id: partnerId, full_name: name }], { onConflict: 'email' })
        .select()
        .single()
      if (error) {
        setAddLearnerMsg({ type: 'error', text: 'Failed to add learner. They may already be registered to another partner.' })
      } else {
        setPendingRegistrations(prev => {
          const filtered = prev.filter(p => p.email !== email)
          return [...filtered, data as PendingRegistration]
        })
        setAddLearnerMsg({ type: 'success', text: `${email} pre-registered. They'll be assigned here when they sign up.` })
        setNewLearnerEmail('')
        setNewLearnerName('')
      }
    }
    setAddingLearner(false)
  }

  const removePendingRegistration = async (id: string) => {
    const { error } = await supabase.from('lms_pending_registrations').delete().eq('id', id)
    if (!error) setPendingRegistrations(prev => prev.filter(p => p.id !== id))
  }

  const startEditRow = (id: string, type: 'learner' | 'pending', full_name: string | null, title: string | null, email: string) => {
    setEditingRowId(id)
    setEditingRowType(type)
    setEditDraft({ full_name: full_name ?? '', title: title ?? '', email })
  }

  const cancelEditRow = () => {
    setEditingRowId(null)
    setEditingRowType(null)
  }

  const saveEditRow = async () => {
    if (!editingRowId || !editingRowType) return
    setSavingRow(true)
    if (editingRowType === 'learner') {
      const { error } = await supabase.from('lms_profiles').update({
        full_name: editDraft.full_name || null,
        title: editDraft.title || null,
        email: editDraft.email,
      }).eq('id', editingRowId)
      if (!error) {
        setLearners(prev => prev.map(l => l.id === editingRowId
          ? { ...l, full_name: editDraft.full_name || null, title: editDraft.title || null, email: editDraft.email }
          : l))
        setEditingRowId(null)
        setEditingRowType(null)
      }
    } else {
      const { error } = await supabase.from('lms_pending_registrations').update({
        full_name: editDraft.full_name || null,
        title: editDraft.title || null,
        email: editDraft.email,
      }).eq('id', editingRowId)
      if (!error) {
        setPendingRegistrations(prev => prev.map(p => p.id === editingRowId
          ? { ...p, full_name: editDraft.full_name || null, title: editDraft.title || null, email: editDraft.email }
          : p))
        setEditingRowId(null)
        setEditingRowType(null)
      }
    }
    setSavingRow(false)
  }

  const handleCertCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvImporting(true)
    setCsvMsg(null)
    e.target.value = ''

    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { setCsvMsg({ type: 'error', text: 'CSV must have a header row and at least one data row.' }); setCsvImporting(false); return }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    const emailIdx = headers.findIndex(h => h === 'email')
    if (emailIdx === -1) { setCsvMsg({ type: 'error', text: 'CSV must have an "Email" column.' }); setCsvImporting(false); return }

    // Collect all cert columns (every column that isn't email/name/title)
    const certColIdxs = headers.map((_h, i) => i).filter(i => i !== emailIdx && !['name', 'full name', 'title', 'role'].includes(headers[i]))

    // Build email → certs map
    const certMap: Record<string, string[]> = {}
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const email = cols[emailIdx]?.toLowerCase()
      if (!email) continue
      const certs = certColIdxs.map(i => cols[i]).filter(Boolean)
      if (!certMap[email]) certMap[email] = []
      certMap[email].push(...certs)
    }

    // Update matching contacts
    let updated = 0
    for (const contact of pendingRegistrations) {
      const certs = certMap[contact.email.toLowerCase()]
      if (!certs || certs.length === 0) continue
      const merged = Array.from(new Set([...(contact.certifications ?? []), ...certs]))
      const { error } = await supabase
        .from('lms_pending_registrations')
        .update({ certifications: merged })
        .eq('id', contact.id)
      if (!error) updated++
    }

    setCsvMsg({ type: 'success', text: `Updated certifications for ${updated} contact${updated !== 1 ? 's' : ''}.` })
    await loadData()
    setCsvImporting(false)
  }

  const toggleUserCert = async (learner: LearnerRow, certId: string) => {
    const earned = learner.earnedCertIds.has(certId)
    if (earned) {
      await supabase.from('lms_user_certifications')
        .delete()
        .eq('user_id', learner.id)
        .eq('certification_id', certId)
      setLearners(prev => prev.map(l => {
        if (l.id !== learner.id) return l
        const next = new Set(l.earnedCertIds)
        next.delete(certId)
        return { ...l, earnedCertIds: next }
      }))
    } else {
      await supabase.from('lms_user_certifications')
        .insert([{ user_id: learner.id, certification_id: certId }])
      setLearners(prev => prev.map(l => {
        if (l.id !== learner.id) return l
        const next = new Set(l.earnedCertIds)
        next.add(certId)
        return { ...l, earnedCertIds: next }
      }))
    }
  }

  const toggleModuleComplete = async (learner: LearnerRow, moduleId: string) => {
    const isCompleted = learner.moduleProgress[moduleId] === 'completed'
    if (isCompleted) {
      // Mark incomplete — delete the progress row
      await supabase.from('lms_user_progress')
        .delete()
        .eq('user_id', learner.id)
        .eq('module_id', moduleId)
      setLearners(prev => prev.map(l => {
        if (l.id !== learner.id) return l
        const mp = { ...l.moduleProgress }
        delete mp[moduleId]
        const completed = Object.values(mp).filter(s => s === 'completed').length
        return { ...l, moduleProgress: mp, completed }
      }))
    } else {
      // Mark complete
      const now = new Date().toISOString()
      await supabase.from('lms_user_progress').upsert(
        [{ user_id: learner.id, module_id: moduleId, status: 'completed', started_at: now, completed_at: now }],
        { onConflict: 'user_id,module_id' }
      )
      setLearners(prev => prev.map(l => {
        if (l.id !== learner.id) return l
        const mp = { ...l.moduleProgress, [moduleId]: 'completed' as const }
        const completed = Object.values(mp).filter(s => s === 'completed').length
        return { ...l, moduleProgress: mp, completed }
      }))
    }
  }

  const toggleCert = async (cert: CertRow) => {
    if (!partnerId) return
    if (cert.pcId) {
      const { error } = await supabase.from('lms_partner_certifications')
        .update({ enabled: !cert.enabled })
        .eq('id', cert.pcId)
      if (!error) {
        setCertifications(prev => prev.map(c => c.id === cert.id ? { ...c, enabled: !c.enabled } : c))
      }
    } else {
      const { data, error } = await supabase.from('lms_partner_certifications')
        .insert([{ partner_id: partnerId, certification_id: cert.id, enabled: true }])
        .select().single()
      if (!error && data) {
        setCertifications(prev => prev.map(c => c.id === cert.id ? { ...c, pcId: (data as any).id, enabled: true } : c))
      }
    }
  }

  const toggleModule = async (mod: ModuleRow) => {
    if (!partnerId) return
    if (mod.pm) {
      const { error } = await supabase.from('lms_partner_modules')
        .update({ enabled: !mod.pm.enabled })
        .eq('id', mod.pm.id)
      if (!error) {
        setModules(prev => prev.map(m => m.id === mod.id ? { ...m, pm: { ...m.pm!, enabled: !m.pm!.enabled } } : m))
      }
    } else {
      const { data, error } = await supabase.from('lms_partner_modules')
        .insert([{ partner_id: partnerId, module_id: mod.id, enabled: true, order_index: mod.default_order }])
        .select().single()
      if (!error && data) {
        setModules(prev => prev.map(m => m.id === mod.id ? { ...m, pm: data as LmsPartnerModule } : m))
      }
    }
  }

  const moveModule = async (index: number, direction: 'up' | 'down') => {
    const newModules = [...modules]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newModules.length) return

    const tmp = newModules[index]
    newModules[index] = newModules[swapIndex]
    newModules[swapIndex] = tmp

    // Re-assign order_index
    const updated = newModules.map((m, i) => ({ ...m, pm: m.pm ? { ...m.pm, order_index: i + 1 } : null }))
    setModules(updated)

    // Persist order changes for modules that have pm rows
    const upserts = updated
      .filter(m => m.pm)
      .map(m => ({ id: m.pm!.id, partner_id: partnerId!, module_id: m.id, enabled: m.pm!.enabled, order_index: m.pm!.order_index }))

    if (upserts.length > 0) {
      await supabase.from('lms_partner_modules').upsert(upserts, { onConflict: 'id' })
    }
  }

  if (loading || !partner) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/partners" className="hover:text-pendo-pink transition-colors">Partners</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-pendo-navy font-medium">{partner.name}</span>
        </div>

        <h1 className="text-3xl font-bold text-pendo-navy mb-8">{partner.name}</h1>

        <div className="space-y-6">
          {/* Partner Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-pendo-navy text-lg mb-4">Partner Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editPartner.name ?? ''}
                  onChange={e => setEditPartner(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <select
                  value={editPartner.enbl_stage ?? 'pre'}
                  onChange={e => setEditPartner(prev => ({ ...prev, enbl_stage: e.target.value as 'pre' | 'active' | 'post' }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
                >
                  <option value="pre">Pre Agreement</option>
                  <option value="active">Active</option>
                  <option value="post">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDM Contact</label>
                <select
                  value={editPartner.pdm ?? ''}
                  onChange={e => setEditPartner(prev => ({ ...prev, pdm: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none bg-white"
                >
                  <option value="">— Unassigned —</option>
                  <option value="Craig Hyatt">Craig Hyatt</option>
                  <option value="Eugene Darmanto">Eugene Darmanto</option>
                  <option value="Gautham Pandiyan">Gautham Pandiyan</option>
                  <option value="Lindsey Paluso">Lindsey Paluso</option>
                  <option value="Madyson Malek">Madyson Malek</option>
                  <option value="Ricardo Villarreal">Ricardo Villarreal</option>
                  <option value="Riley Huber">Riley Huber</option>
                  <option value="Tomoo Taniguchi">Tomoo Taniguchi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={editPartner.region ?? ''}
                  onChange={e => setEditPartner(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none bg-white"
                >
                  <option value="">— Unassigned —</option>
                  <option value="North America">North America</option>
                  <option value="EMEA">EMEA</option>
                  <option value="LATAM">LATAM</option>
                  <option value="APAC">APAC</option>
                  <option value="JAPAN">JAPAN</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Partner Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PARTNER_TYPES.map(type => {
                    const selected = parseTypes(editPartner.category_type).includes(type)
                    return (
                      <label key={type} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={e => {
                            const current = parseTypes(editPartner.category_type)
                            const next = e.target.checked
                              ? [...current, type]
                              : current.filter(t => t !== type)
                            setEditPartner(prev => ({ ...prev, category_type: next.join(', ') || null as any }))
                          }}
                          className="rounded border-gray-300 text-pendo-pink focus:ring-pendo-pink"
                        />
                        {type}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editPartner.notes ?? ''}
                  onChange={e => setEditPartner(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* Salesforce Account */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesforce Account</label>
                {editPartner.salesforce_account_id ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={`https://pendo.lightning.force.com/lightning/r/Account/${editPartner.salesforce_account_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                      </svg>
                      {editPartner.salesforce_account_name || editPartner.salesforce_account_id}
                      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => { setEditPartner(prev => ({ ...prev, salesforce_account_id: '', salesforce_account_name: '' })); setSfSearchOpen(true) }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSfSearchOpen(o => !o)}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Salesforce account…
                  </button>
                )}
                {sfSearchOpen && (
                  <div className="mt-2 relative">
                    <input
                      autoFocus
                      type="text"
                      value={sfQuery}
                      onChange={e => searchSfAccounts(e.target.value)}
                      placeholder="Type account name…"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    />
                    {sfResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {sfResults.map(r => (
                          <button
                            key={r.sf_id}
                            onClick={() => selectSfAccount(r)}
                            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900">{r.name}</div>
                              {r.website && <div className="text-xs text-gray-400">{r.website}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {sfQuery.length >= 2 && sfResults.length === 0 && (
                      <p className="mt-1 text-xs text-gray-400">No accounts found — try a different name</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={savePartner}
                disabled={saving}
                className="px-4 py-2 bg-pendo-pink text-white rounded-lg text-sm font-semibold hover:bg-pendo-pink-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
            </div>
          </div>

          {/* Email Domains */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-pendo-navy text-lg mb-4">Email Domains</h2>
            <p className="text-sm text-gray-500 mb-4">
              Partner employees with these email domains will be auto-assigned to this partner when they sign up.
            </p>
            <div className="space-y-2 mb-4">
              {domains.length === 0 && (
                <p className="text-sm text-gray-400 italic">No domains configured</p>
              )}
              {domains.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-mono text-gray-700">{d.domain}</span>
                  <button
                    onClick={() => deleteDomain(d.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="e.g. accenture.com"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none font-mono"
              />
              <button
                onClick={addDomain}
                disabled={addingDomain || !newDomain.trim()}
                className="px-4 py-2 bg-pendo-navy text-white rounded-lg text-sm font-medium hover:bg-pendo-navy-light transition-colors disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {domainError && <p className="text-xs text-red-500 mt-2">{domainError}</p>}
          </div>

          {/* Certifications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-pendo-navy text-lg mb-2">Certifications</h2>
            <p className="text-sm text-gray-500 mb-4">
              Toggle which Pendo Academy certifications learners should complete before starting enablement.
            </p>
            <div className="space-y-2">
              {certifications.map(cert => (
                <div key={cert.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${cert.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => window.open(cert.url, '_blank')}
                      className="text-sm font-medium text-pendo-navy hover:text-pendo-pink transition-colors text-left"
                    >
                      {cert.title} ↗
                    </button>
                    {cert.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{cert.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCert(cert)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                      ${cert.enabled ? 'bg-pendo-pink' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                      ${cert.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-pendo-navy text-lg">Modules</h2>
              {(() => {
                const allEnabled = modules.length > 0 && modules.every(m => m.pm?.enabled)
                const anyEnabled = modules.some(m => m.pm?.enabled)
                return (
                  <button
                    onClick={async () => {
                      const target = !allEnabled
                      const updated = await Promise.all(modules.map(async mod => {
                        if (mod.pm) {
                          await supabase.from('lms_partner_modules').update({ enabled: target }).eq('id', mod.pm.id)
                        } else {
                          await supabase.from('lms_partner_modules')
                            .insert([{ partner_id: partnerId, module_id: mod.id, enabled: target, order_index: mod.default_order }])
                        }
                        return { ...mod, pm: mod.pm ? { ...mod.pm, enabled: target } : { id: '', partner_id: partnerId!, module_id: mod.id, enabled: target, order_index: mod.default_order, created_at: new Date().toISOString() } }
                      }))
                      setModules(updated)
                    }}
                    className="text-xs font-semibold text-pendo-pink hover:underline"
                  >
                    {allEnabled ? 'Deselect all' : anyEnabled ? 'Select all' : 'Select all'}
                  </button>
                )
              })()}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Toggle which modules this partner's learners can access. Use arrows to reorder.
            </p>
            <div className="space-y-2">
              {modules.map((mod, idx) => (
                <div key={mod.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${mod.pm?.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveModule(idx, 'up')}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveModule(idx, 'down')}
                      disabled={idx === modules.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-pendo-navy truncate">{mod.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                        ${mod.category === 'delivery' ? 'bg-blue-100 text-blue-700' :
                          mod.category === 'product' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'}`}>
                        {mod.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleModule(mod)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                      ${mod.pm?.enabled ? 'bg-pendo-pink' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                      ${mod.pm?.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Learners */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-pendo-navy text-lg">
                Learners <span className="text-gray-400 font-normal text-base">({learners.length + pendingRegistrations.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {certifications.filter(c => c.enabled).length > 0 && (
                  <select
                    value={certFilter}
                    onChange={e => setCertFilter(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                  >
                    <option value="all">All Learners</option>
                    {certifications.filter(c => c.enabled).map(c => (
                      <option key={c.id} value={c.id}>Has: {c.title}</option>
                    ))}
                    {certifications.filter(c => c.enabled).map(c => (
                      <option key={`missing-${c.id}`} value={`missing-${c.id}`}>Missing: {c.title}</option>
                    ))}
                  </select>
                )}
                <label className={`flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors ${csvImporting ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {csvImporting ? 'Importing…' : 'Import Certs'}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCertCsv} />
                </label>
                <button
                  onClick={() => { setShowAddLearner(v => !v); setAddLearnerMsg(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pendo-pink text-white rounded-lg text-sm font-medium hover:bg-pendo-pink-dark transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Learner
                </button>
              </div>
            </div>
            {csvMsg && (
              <p className={`text-xs mb-3 ${csvMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{csvMsg.text}</p>
            )}

            {/* Add Learner form */}
            {showAddLearner && (
              <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-pendo-navy mb-3">Add a learner by email</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={newLearnerName}
                    onChange={e => setNewLearnerName(e.target.value)}
                    placeholder="Full name (optional)"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
                  />
                  <input
                    type="email"
                    value={newLearnerEmail}
                    onChange={e => setNewLearnerEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLearner()}
                    placeholder="Email address"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-pendo-pink focus:border-transparent outline-none"
                  />
                  <button
                    onClick={addLearner}
                    disabled={addingLearner || !newLearnerEmail.trim()}
                    className="px-4 py-2 bg-pendo-navy text-white rounded-lg text-sm font-medium hover:bg-pendo-navy-light transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    {addingLearner ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {addLearnerMsg && (
                  <p className={`text-xs mt-1 ${addLearnerMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {addLearnerMsg.text}
                  </p>
                )}
              </div>
            )}

            {(() => {
              const enabledCerts = certifications.filter(c => c.enabled)
              const filteredLearners = learners.filter(l => {
                if (certFilter === 'all') return true
                if (certFilter.startsWith('missing-')) {
                  const cId = certFilter.replace('missing-', '')
                  return !l.earnedCertIds.has(cId)
                }
                return l.earnedCertIds.has(certFilter)
              })
              const totalCols = 4 + enabledCerts.length

              return (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Name</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Email</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Title</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Modules</th>
                        {enabledCerts.map(c => (
                          <th key={c.id} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">
                            {c.title.replace('Pendo Essentials for ', '').replace('Pendo Certification: ', '').replace('Pendo for ', '')}
                          </th>
                        ))}
                        <th className="pb-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {/* Active learners */}
                      {filteredLearners.map(l => {
                        const isEditing = editingRowId === l.id && editingRowType === 'learner'
                        const isExpanded = expandedLearnerId === l.id
                        const enabledModules = modules.filter(m => m.pm?.enabled)
                        const completedCount = enabledModules.filter(m => l.moduleProgress[m.id] === 'completed').length
                        return (
                          <>
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input autoFocus value={editDraft.full_name} onChange={e => setEditDraft(d => ({ ...d, full_name: e.target.value }))}
                                  placeholder="Full name"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="font-medium text-pendo-navy text-sm">{l.full_name ?? '—'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))}
                                  placeholder="Email"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="text-sm text-gray-500">{l.email}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                                  placeholder="Title"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="text-sm text-gray-500">{l.title ?? '—'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                onClick={() => setExpandedLearnerId(isExpanded ? null : l.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-pendo-navy hover:text-pendo-pink transition-colors"
                              >
                                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>{completedCount}/{enabledModules.length}</span>
                              </button>
                            </td>
                            {enabledCerts.map(c => (
                              <td key={c.id} className="py-2 pr-3">
                                <button
                                  onClick={() => toggleUserCert(l, c.id)}
                                  title={l.earnedCertIds.has(c.id) ? 'Earned — click to remove' : 'Not earned — click to mark complete'}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                                    ${l.earnedCertIds.has(c.id)
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {l.earnedCertIds.has(c.id) ? 'Earned' : 'Not earned'}
                                </button>
                              </td>
                            ))}
                            <td className="py-2 w-16">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={saveEditRow} disabled={savingRow}
                                    className="text-xs px-2 py-1 bg-pendo-pink text-white rounded font-medium disabled:opacity-50">
                                    {savingRow ? '…' : 'Save'}
                                  </button>
                                  <button onClick={cancelEditRow}
                                    className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded font-medium">
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => startEditRow(l.id, 'learner', l.full_name, l.title, l.email)}
                                  className="text-gray-300 hover:text-pendo-pink transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${l.id}-modules`} className="bg-gray-50">
                              <td colSpan={totalCols + 1} className="px-4 py-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Module Progress</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {enabledModules.map(m => {
                                    const isComplete = l.moduleProgress[m.id] === 'completed'
                                    return (
                                      <button
                                        key={m.id}
                                        onClick={() => toggleModuleComplete(l, m.id)}
                                        title={isComplete ? 'Completed — click to mark incomplete' : 'Not completed — click to mark complete'}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors
                                          ${isComplete
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
                                      >
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isComplete ? 2.5 : 1.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="truncate">{m.title}</span>
                                        <span className={`ml-auto flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                                          m.category === 'delivery' ? 'bg-blue-100 text-blue-600' :
                                          m.category === 'product' ? 'bg-purple-100 text-purple-600' :
                                          m.category === 'services' ? 'bg-orange-100 text-orange-600' :
                                          'bg-green-100 text-green-600'}`}>{m.category}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        )
                      })}

                      {/* Contacts (not yet signed in) */}
                      {pendingRegistrations.map(p => {
                        const isEditing = editingRowId === p.id && editingRowType === 'pending'
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input autoFocus value={editDraft.full_name} onChange={e => setEditDraft(d => ({ ...d, full_name: e.target.value }))}
                                  placeholder="Full name"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="font-medium text-pendo-navy text-sm">{p.full_name ?? '—'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))}
                                  placeholder="Email"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="text-sm text-gray-500">{p.email}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                                  placeholder="Title"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-pendo-pink outline-none" />
                              ) : (
                                <span className="text-sm text-gray-500">{p.title ?? '—'}</span>
                              )}
                            </td>
                            {enabledCerts.map(c => (
                              <td key={c.id} className="py-2 pr-3">
                                {(p.certifications ?? []).some(name => name.toLowerCase() === c.title.toLowerCase()) ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Earned
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                            ))}
                            <td className="py-2 w-16">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={saveEditRow} disabled={savingRow}
                                    className="text-xs px-2 py-1 bg-pendo-pink text-white rounded font-medium disabled:opacity-50">
                                    {savingRow ? '…' : 'Save'}
                                  </button>
                                  <button onClick={cancelEditRow}
                                    className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded font-medium">
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => startEditRow(p.id, 'pending', p.full_name, p.title, p.email)}
                                    className="text-gray-300 hover:text-pendo-pink transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button onClick={() => removePendingRegistration(p.id)}
                                    className="text-gray-300 hover:text-red-500 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {filteredLearners.length === 0 && pendingRegistrations.length === 0 && (
                        <tr>
                          <td colSpan={totalCols} className="py-8 text-center text-sm text-gray-400 italic">
                            No learners yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </Layout>
  )
}
