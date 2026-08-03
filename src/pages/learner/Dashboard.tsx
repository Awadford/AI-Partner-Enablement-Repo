import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { ModuleCard } from '../../components/ModuleCard'
import { ProgressBar } from '../../components/ProgressBar'
import { Partner, LmsModule, LmsPartnerModule, ModuleWithProgress } from '../../types'

export function LearnerDashboard() {
  const { profile } = useAuth()
  const { progress } = useProgress(profile?.id ?? null)

  const [partner, setPartner] = useState<Partner | null>(null)
  const [modules, setModules] = useState<ModuleWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile?.partner_id) {
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

  if (!profile?.partner_id) {
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
            Welcome back{profile.full_name ? `, ${profile.full_name}` : ''}. Continue your enablement journey below.
          </p>
        </div>

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
          <h2 className="font-semibold text-pendo-navy mb-4">Learning Path</h2>
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
