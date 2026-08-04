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

export function AdminPartnerDetail() {
  const { partnerId } = useParams<{ partnerId: string }>()

  const [partner, setPartner] = useState<Partner | null>(null)
  const [editPartner, setEditPartner] = useState<Partial<Partner>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [domains, setDomains] = useState<LmsPartnerDomain[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [addingDomain, setAddingDomain] = useState(false)

  const [modules, setModules] = useState<ModuleRow[]>([])
  const [certifications, setCertifications] = useState<CertRow[]>([])
  const [learners, setLearners] = useState<LearnerRow[]>([])
  const [certFilter, setCertFilter] = useState<string>('all')

  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!partnerId) return

    const [partnerRes, domainsRes, modulesRes, pmRes, profilesRes, progressRes, certsRes, pcRes, ucRes] = await Promise.all([
      supabase.from('partners').select('*').eq('id', partnerId).single(),
      supabase.from('lms_partner_domains').select('*').eq('partner_id', partnerId),
      supabase.from('lms_modules').select('*').order('default_order'),
      supabase.from('lms_partner_modules').select('*').eq('partner_id', partnerId),
      supabase.from('lms_profiles').select('*').eq('partner_id', partnerId).eq('is_admin', false),
      supabase.from('lms_user_progress').select('*'),
      supabase.from('lms_certifications').select('*').order('order_index'),
      supabase.from('lms_partner_certifications').select('*').eq('partner_id', partnerId),
      supabase.from('lms_user_certifications').select('*'),
    ])

    const p = partnerRes.data as Partner
    setPartner(p)
    setEditPartner({ name: p.name, notes: p.notes ?? '', enbl_stage: p.enbl_stage })
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
    }).eq('id', partnerId)
    setSaving(false)
    if (!error) {
      setSaveMsg('Saved!')
      setPartner(prev => prev ? { ...prev, ...editPartner } as Partner : null)
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  const addDomain = async () => {
    if (!newDomain.trim() || !partnerId) return
    setAddingDomain(true)
    const { data, error } = await supabase
      .from('lms_partner_domains')
      .insert([{ partner_id: partnerId, domain: newDomain.trim().toLowerCase() }])
      .select()
      .single()
    if (!error && data) {
      setDomains(prev => [...prev, data as LmsPartnerDomain])
      setNewDomain('')
    }
    setAddingDomain(false)
  }

  const deleteDomain = async (id: string) => {
    const { error } = await supabase.from('lms_partner_domains').delete().eq('id', id)
    if (!error) setDomains(prev => prev.filter(d => d.id !== id))
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
                  <option value="pre">Pre</option>
                  <option value="active">Active</option>
                  <option value="post">Post</option>
                </select>
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
            <h2 className="font-semibold text-pendo-navy text-lg mb-2">Modules</h2>
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
                Learners <span className="text-gray-400 font-normal text-base">({learners.length})</span>
              </h2>
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
            </div>
            {learners.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No learners registered for this partner yet.</p>
            ) : (() => {
              const enabledCerts = certifications.filter(c => c.enabled)
              const filtered = learners.filter(l => {
                if (certFilter === 'all') return true
                if (certFilter.startsWith('missing-')) {
                  const cId = certFilter.replace('missing-', '')
                  return !l.earnedCertIds.has(cId)
                }
                return l.earnedCertIds.has(certFilter)
              })
              return (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Name</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Title</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pr-4">Email</th>
                        {enabledCerts.map(c => (
                          <th key={c.id} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 px-2 max-w-[80px]">
                            <span className="block truncate" title={c.title}>{c.title.replace('Pendo Essentials for ', '').replace('Pendo for ', '')}</span>
                          </th>
                        ))}
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 pl-4">Module Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(l => {
                        const enabledModules = modules.filter(m => m.pm?.enabled)
                        return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <span className="font-medium text-pendo-navy text-sm">{l.full_name ?? '—'}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-gray-500">{l.title ?? '—'}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-gray-500">{l.email}</span>
                          </td>
                          {enabledCerts.map(c => (
                            <td key={c.id} className="py-3 px-2 text-center">
                              <button
                                onClick={() => toggleUserCert(l, c.id)}
                                title={l.earnedCertIds.has(c.id) ? 'Mark as not completed' : 'Mark as completed'}
                                className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors
                                  ${l.earnedCertIds.has(c.id)
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </td>
                          ))}
                          <td className="py-3 pl-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {enabledModules.map(m => {
                                const status = l.moduleProgress[m.id] ?? 'not_started'
                                const colors = {
                                  completed: 'bg-green-500',
                                  in_progress: 'bg-amber-400',
                                  not_started: 'bg-gray-200',
                                }
                                const labels = {
                                  completed: 'Completed',
                                  in_progress: 'In Progress',
                                  not_started: 'Not Started',
                                }
                                return (
                                  <div
                                    key={m.id}
                                    title={`${m.title}: ${labels[status]}`}
                                    className={`w-3 h-3 rounded-full flex-shrink-0 ${colors[status]}`}
                                  />
                                )
                              })}
                              <span className="text-xs text-gray-400 ml-1">{l.completed}/{l.total}</span>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4 + enabledCerts.length} className="py-8 text-center text-sm text-gray-400 italic">
                            No learners match this filter.
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
