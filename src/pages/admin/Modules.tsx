import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { LmsModule } from '../../types'

interface EditState {
  video_url: string
  exec_url: string
  exec_prompt: string
}

export function AdminModules() {
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ video_url: '', exec_url: '', exec_prompt: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

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

  function startEdit(mod: LmsModule) {
    setEditing(mod.id)
    setEditState({
      video_url: mod.content?.video_url ?? '',
      exec_url: mod.content?.exec_url ?? '',
      exec_prompt: mod.content?.exec_prompt ?? '',
    })
  }

  async function saveEdit(mod: LmsModule) {
    setSaving(true)
    const updatedContent = {
      ...mod.content,
      video_url: editState.video_url || null,
      exec_url: editState.exec_url || null,
      exec_prompt: editState.exec_prompt || undefined,
    }
    const { error } = await supabase
      .from('lms_modules')
      .update({ content: updatedContent, updated_at: new Date().toISOString() })
      .eq('id', mod.id)

    if (!error) {
      setModules(prev => prev.map(m => m.id === mod.id ? { ...m, content: updatedContent } : m))
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(null), 2000)
    } else {
      setSaveMsg('Error saving')
    }
    setSaving(false)
    setEditing(null)
  }

  const categoryColors: Record<string, string> = {
    delivery: 'bg-blue-100 text-blue-700',
    product: 'bg-purple-100 text-purple-700',
    services: 'bg-orange-100 text-orange-700',
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-pendo-navy">Module Catalog</h1>
            <p className="text-gray-500 mt-1">{modules.length} modules — click a module to edit video and exec.com URLs</p>
          </div>
          {saveMsg && (
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${saveMsg === 'Saved!' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {saveMsg}
            </span>
          )}
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

                    {/* URL / exec.com edit section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Video & exec.com URLs</p>
                        {editing !== mod.id && (
                          <button
                            onClick={() => startEdit(mod)}
                            className="text-xs text-pendo-pink font-semibold hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {editing === mod.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                            <input
                              type="text"
                              value={editState.video_url}
                              onChange={e => setEditState(s => ({ ...s, video_url: e.target.value }))}
                              placeholder="https://… (MP4, YouTube, Vimeo, Loom)"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">exec.com Session URL</label>
                            <input
                              type="text"
                              value={editState.exec_url}
                              onChange={e => setEditState(s => ({ ...s, exec_url: e.target.value }))}
                              placeholder="https://app.exec.com/sessions/…"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">exec.com Practice Prompt</label>
                            <textarea
                              value={editState.exec_prompt}
                              onChange={e => setEditState(s => ({ ...s, exec_prompt: e.target.value }))}
                              rows={3}
                              placeholder="Describe the scenario the learner should practice…"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink resize-none"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(mod)}
                              disabled={saving}
                              className="px-4 py-1.5 bg-pendo-pink text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-20 flex-shrink-0">Video:</span>
                            <span className="text-gray-800 truncate">{mod.content?.video_url || <span className="text-gray-400 italic">not set</span>}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-20 flex-shrink-0">exec.com:</span>
                            <span className="text-gray-800 truncate">{mod.content?.exec_url || <span className="text-gray-400 italic">not set</span>}</span>
                          </div>
                          {mod.content?.exec_prompt && (
                            <div className="flex gap-2">
                              <span className="text-gray-500 w-20 flex-shrink-0">Prompt:</span>
                              <span className="text-gray-800 line-clamp-2">{mod.content.exec_prompt}</span>
                            </div>
                          )}
                        </div>
                      )}
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
