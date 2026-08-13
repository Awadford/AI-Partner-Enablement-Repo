import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { Partner, LmsProfile } from '../../types'

interface Stats {
  totalPartners: number
  activePartners: number
  totalLearners: number
  totalModules: number
  totalCertifications: number
}

interface LearnerRow extends LmsProfile {
  partnerName: string | null
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [partners, setPartners] = useState<Partner[]>([])
  const [stats, setStats] = useState<Stats>({
    totalPartners: 0,
    activePartners: 0,
    totalLearners: 0,
    totalModules: 0,
    totalCertifications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showLearners, setShowLearners] = useState(false)
  const [learners, setLearners] = useState<LearnerRow[]>([])

  useEffect(() => {
    async function load() {
      const [partnersRes, learnersRes, modulesRes, certsRes, pendingCertsRes] = await Promise.all([
        supabase.from('partners').select('*').order('name'),
        supabase.from('lms_profiles').select('*, partners(name)').eq('is_admin', false).eq('is_pdm', false),
        supabase.from('lms_modules').select('id'),
        supabase.from('lms_user_certifications').select('id'),
        supabase.from('lms_pending_registrations').select('certifications'),
      ])

      const partnerList = (partnersRes.data ?? []) as Partner[]
      setPartners(partnerList.slice(0, 5))

      const learnerList = ((learnersRes.data ?? []) as any[]).map(l => ({
        ...l,
        partnerName: l.partners?.name ?? null,
      }))
      setLearners(learnerList)

      setStats({
        totalPartners: partnerList.length,
        activePartners: partnerList.filter(p => p.enbl_stage === 'active').length,
        totalLearners: learnerList.length,
        totalModules: modulesRes.data?.length ?? 0,
        totalCertifications: (certsRes.data?.length ?? 0) +
          ((pendingCertsRes.data ?? []) as { certifications: string[] }[])
            .reduce((sum, r) => sum + (r.certifications?.length ?? 0), 0),
      })
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    {
      label: 'Total Partners',
      value: stats.totalPartners,
      icon: '🏢',
      onClick: () => navigate('/admin/partners'),
    },
    {
      label: 'Active Partners',
      value: stats.activePartners,
      icon: '✅',
      onClick: () => navigate('/admin/partners?stage=active'),
    },
    {
      label: 'Registered Learners',
      value: stats.totalLearners,
      icon: '👥',
      onClick: () => setShowLearners(true),
    },
    {
      label: 'Total Modules',
      value: stats.totalModules,
      icon: '📚',
      onClick: () => navigate('/admin/modules'),
    },
    {
      label: 'Certifications Earned',
      value: stats.totalCertifications,
      icon: '🏅',
      onClick: null,
    },
  ]

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pendo-navy">Admin Overview</h1>
          <p className="text-gray-500 mt-1">Pendo Partner Enablement — LMS Management</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {statCards.map(card => (
                card.onClick ? (
                  <button
                    key={card.label}
                    onClick={card.onClick}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-left hover:border-pendo-pink hover:shadow-md transition-all group"
                  >
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="text-3xl font-bold text-pendo-navy group-hover:text-pendo-pink transition-colors">{card.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                  </button>
                ) : (
                  <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="text-3xl font-bold text-pendo-navy">{card.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                  </div>
                )
              ))}
            </div>

            {/* Recent Partners */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-pendo-navy">Recent Partners</h2>
                <Link to="/admin/partners" className="text-sm text-pendo-pink hover:text-pendo-pink-dark font-medium">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {partners.map(p => (
                  <Link
                    key={p.id}
                    to={`/admin/partners/${p.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-pendo-navy">{p.name}</span>
                      {p.pdm && <span className="text-sm text-gray-500 ml-2">PDM: {p.pdm}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                        ${p.enbl_stage === 'active' ? 'bg-green-100 text-green-700' :
                          p.enbl_stage === 'pre' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {p.enbl_stage === 'pre' ? 'Pre Agreement' : p.enbl_stage === 'post' ? 'Inactive' : 'Active'}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Learners modal */}
      {showLearners && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={() => setShowLearners(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-pendo-navy text-lg">All Registered Learners ({learners.length})</h2>
              <button onClick={() => setShowLearners(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Partner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {learners.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-pendo-navy">{l.full_name ?? '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{l.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{l.partnerName ?? '—'}</td>
                    </tr>
                  ))}
                  {learners.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">No learners registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
