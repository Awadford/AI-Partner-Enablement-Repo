import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { Partner } from '../../types'

interface Stats {
  totalPartners: number
  activePartners: number
  totalLearners: number
  totalModules: number
  completedProgressEntries: number
}

export function AdminDashboard() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [stats, setStats] = useState<Stats>({
    totalPartners: 0,
    activePartners: 0,
    totalLearners: 0,
    totalModules: 0,
    completedProgressEntries: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [partnersRes, learnersRes, modulesRes, progressRes] = await Promise.all([
        supabase.from('partners').select('*').order('name'),
        supabase.from('lms_profiles').select('id').eq('is_admin', false),
        supabase.from('lms_modules').select('id'),
        supabase.from('lms_user_progress').select('id').eq('status', 'completed'),
      ])

      const partnerList = (partnersRes.data ?? []) as Partner[]
      setPartners(partnerList.slice(0, 5))
      setStats({
        totalPartners: partnerList.length,
        activePartners: partnerList.filter(p => p.enbl_stage === 'active').length,
        totalLearners: learnersRes.data?.length ?? 0,
        totalModules: modulesRes.data?.length ?? 0,
        completedProgressEntries: progressRes.data?.length ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Partners', value: stats.totalPartners, color: 'bg-blue-50 text-blue-700', icon: '🏢' },
    { label: 'Active Partners', value: stats.activePartners, color: 'bg-green-50 text-green-700', icon: '✅' },
    { label: 'Registered Learners', value: stats.totalLearners, color: 'bg-purple-50 text-purple-700', icon: '👥' },
    { label: 'Total Modules', value: stats.totalModules, color: 'bg-orange-50 text-orange-700', icon: '📚' },
    { label: 'Module Completions', value: stats.completedProgressEntries, color: 'bg-pendo-pink bg-opacity-10 text-pendo-pink', icon: '🎯' },
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
                <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-3xl font-bold text-pendo-navy">{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                </div>
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
                        {p.enbl_stage}
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
    </Layout>
  )
}
