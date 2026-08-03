import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { LmsModule } from '../../types'

export function AdminModules() {
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lms_modules')
        .select('*')
        .order('default_order')
      setModules((data ?? []) as LmsModule[])
      setLoading(false)
    }
    load()
  }, [])

  const categoryColors: Record<string, string> = {
    delivery: 'bg-blue-100 text-blue-700',
    product: 'bg-purple-100 text-purple-700',
    services: 'bg-orange-100 text-orange-700',
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-pendo-navy">Module Catalog</h1>
          <p className="text-gray-500 mt-1">{modules.length} modules in the system</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map(mod => (
              <div key={mod.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-pendo-pink bg-opacity-10 flex items-center justify-center text-pendo-pink text-sm font-semibold flex-shrink-0">
                    {mod.default_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[mod.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {mod.category}
                      </span>
                    </div>
                    <h3 className="font-semibold text-pendo-navy">{mod.title}</h3>
                    <p className="text-sm text-gray-500 truncate">{mod.description}</p>
                  </div>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expanded === mod.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expanded === mod.id && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                    {mod.content?.synopsis && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Synopsis</p>
                        <p className="text-sm text-gray-700">{mod.content.synopsis}</p>
                      </div>
                    )}
                    {mod.content?.why_it_matters && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Why It Matters</p>
                        <p className="text-sm text-gray-700">{mod.content.why_it_matters}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="text-xl font-bold text-pendo-navy">{mod.content?.docs?.length ?? 0}</div>
                        <div className="text-xs text-gray-500">Docs</div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="text-xl font-bold text-pendo-navy">{mod.content?.recordings?.length ?? 0}</div>
                        <div className="text-xs text-gray-500">Recordings</div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="text-xl font-bold text-pendo-navy">{mod.content?.scenario ? '✓' : '—'}</div>
                        <div className="text-xs text-gray-500">Scenario</div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="text-xl font-bold text-pendo-navy">{mod.content?.video_url ? '✓' : '—'}</div>
                        <div className="text-xs text-gray-500">Video</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
