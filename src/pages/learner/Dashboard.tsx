import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { ModuleCard } from '../../components/ModuleCard'
import { ProgressBar } from '../../components/ProgressBar'
import { Partner, LmsModule, LmsPartnerModule, ModuleWithProgress, LmsCertification, LmsUserCertification } from '../../types'
import { LinkModal } from '../../components/LinkModal'

export function LearnerDashboard() {
  const { profile } = useAuth()
  const { progress } = useProgress(profile?.id ?? null)

  const [partner, setPartner] = useState<Partner | null>(null)
  const [modules, setModules] = useState<ModuleWithProgress[]>([])
  const [certifications, setCertifications] = useState<LmsCertification[]>([])
  const [earnedCertIds, setEarnedCertIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [modalLink, setModalLink] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    async function load() {
      if (!profile) {
        setLoading(false)
        return
      }

      if (profile.is_admin) {
        // Admins see all modules + all certifications
        const [allModulesRes, allCertsRes, earnedRes] = await Promise.all([
          supabase.from('lms_modules').select('*').order('category', { ascending: true }).order('default_order', { ascending: true }),
          supabase.from('lms_certifications').select('*').order('order_index', { ascending: true }),
          supabase.from('lms_user_certifications').select('certification_id').eq('user_id', profile.id),
        ])

        if (allModulesRes.data) {
          const withProgress: ModuleWithProgress[] = (allModulesRes.data as LmsModule[]).map((mod, idx) => ({
            ...mod,
            order_index: idx,
            enabled: true,
            status: progress[mod.id]?.status ?? 'not_started',
            locked: false,
          }))
          setModules(withProgress)
        }
        if (allCertsRes.data) setCertifications(allCertsRes.data as LmsCertification[])
        if (earnedRes.data) setEarnedCertIds(new Set((earnedRes.data as LmsUserCertification[]).map(r => r.certification_id)))
        setLoading(false)
        return
      }

      if (!profile.partner_id) {
        setLoading(false)
        return
      }

      // Load partner info
      const { data: partnerData } = await supabase
        .from('partners')
        .select('*')
        .eq('id', profile.partner_id)
        .single()
      setPartner(partnerData as Partner)

      // Load enabled certifications for this partner + which ones the user has earned
      const [certRows, earnedRes] = await Promise.all([
        supabase.from('lms_partner_certifications').select('*, lms_certifications(*)').eq('partner_id', profile.partner_id).eq('enabled', true).order('lms_certifications(order_index)', { ascending: true }),
        supabase.from('lms_user_certifications').select('certification_id').eq('user_id', profile.id),
      ])

      if (certRows.data) {
        setCertifications(
          certRows.data
            .filter((r: any) => r.lms_certifications)
            .map((r: any) => r.lms_certifications as LmsCertification)
        )
      }
      if (earnedRes.data) setEarnedCertIds(new Set((earnedRes.data as LmsUserCertification[]).map(r => r.certification_id)))

      // Load enabled modules for this partner
      const { data: pmRows } = await supabase
        .from('lms_partner_modules')
        .select('*, lms_modules(*)')
        .eq('partner_id', profile.partner_id)
        .eq('enabled', true)
        .order('order_index', { ascending: true })

      if (pmRows) {
        const withProgress: ModuleWithProgress[] = (pmRows as (LmsPartnerModule & { lms_modules: LmsModule })[])
          .filter(row => row.lms_modules)
          .map((row, idx) => {
            const mod = row.lms_modules
            const prog = progress[mod.id]
            const status = prog?.status ?? 'not_started'
            const locked = idx > 0 && (progress[pmRows[idx - 1].module_id]?.status !== 'completed')
            return {
              ...mod,
              order_index: row.order_index,
              enabled: row.enabled,
              status,
              locked,
            }
          })
        setModules(withProgress)
      }

      setLoading(false)
    }
    load()
  }, [profile, progress])

  const completedCount = modules.filter(m => m.status === 'completed').length

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
        </div>
      </Layout>
    )
  }

  if (!profile?.is_admin && !profile?.partner_id) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-16 px-4 text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
            <h2 className="text-xl font-semibold text-pendo-navy mb-2">No Partner Assigned</h2>
            <p className="text-gray-600">
              Your email domain hasn't been linked to a partner yet. Please contact your Pendo account manager.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-pendo-pink uppercase tracking-wider">Partner</span>
          </div>
          <h1 className="text-3xl font-bold text-pendo-navy">{partner?.name ?? 'Your Portal'}</h1>
          <p className="text-gray-500 mt-1">
            Welcome back{profile.full_name ? `, ${profile.full_name}` : ''}. Complete your certifications first, then work through the enablement modules below.
          </p>
        </div>

        {/* Certifications */}
        {certifications.length > 0 && (
          <div className="mb-8">
            <h2 className="font-semibold text-pendo-navy mb-1">Certifications</h2>
            <p className="text-sm text-gray-500 mb-4">
              Complete these before starting enablement. All certifications are free — use code{' '}
              <span className="font-mono font-semibold text-pendo-pink bg-pink-50 px-1.5 py-0.5 rounded">pendopartners</span>{' '}
              at checkout for 100% off.
            </p>
            <div className="space-y-3">
              {certifications.map((cert, idx) => {
                const earned = earnedCertIds.has(cert.id)
                return (
                  <button
                    key={cert.id}
                    onClick={() => setModalLink({ url: cert.url, title: cert.title })}
                    className={`w-full flex items-start gap-4 bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all group text-left
                      ${earned ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-pendo-pink'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5
                      ${earned ? 'bg-green-100 text-green-700' : 'bg-pendo-navy bg-opacity-10 text-pendo-navy'}`}>
                      {earned
                        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold transition-colors ${earned ? 'text-green-700' : 'text-pendo-navy group-hover:text-pendo-pink'}`}>{cert.title}</h3>
                        {earned && <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Earned</span>}
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-pendo-pink transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      {cert.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{cert.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Link modal */}
        {modalLink && (
          <LinkModal url={modalLink.url} title={modalLink.title} onClose={() => setModalLink(null)} />
        )}

        {/* Progress overview */}
        {modules.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-pendo-navy">Overall Progress</h2>
              <span className="text-sm text-gray-500">{completedCount}/{modules.length} modules</span>
            </div>
            <ProgressBar completed={completedCount} total={modules.length} showLabel={false} />
            {completedCount === modules.length && modules.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Congratulations — you've completed all modules!
              </div>
            )}
          </div>
        )}

        {/* Module list */}
        <div>
          <h2 className="font-semibold text-pendo-navy mb-4">Enablement Modules</h2>
          {modules.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              No modules have been assigned to your partner yet.
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((mod, idx) => (
                <ModuleCard key={mod.id} module={mod} index={idx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
