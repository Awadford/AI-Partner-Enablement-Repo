import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { LmsModule } from '../../types'

interface DocItem { title: string; url: string }

interface IframeOverrides {
  video: boolean
  resources: boolean
  recordings: boolean
  exec: boolean
}

interface EditState {
  video_url: string
  video_url_extension: string
  docs: DocItem[]
  recordings: DocItem[]
  exec_url: string
  exec_prompt: string
  iframe_url: string
  iframe_overrides: IframeOverrides
}

export function AdminModules() {
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ video_url: '', video_url_extension: '', docs: [], recordings: [], exec_url: '', exec_prompt: '', iframe_url: '', iframe_overrides: { video: false, resources: false, recordings: false, exec: false } })
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
      video_url_extension: mod.content?.video_url_extension ?? '',
      docs: mod.content?.docs?.map((d: DocItem) => ({ ...d })) ?? [],
      recordings: mod.content?.recordings?.map((r: DocItem) => ({ ...r })) ?? [],
      exec_url: mod.content?.exec_url ?? '',
      exec_prompt: mod.content?.exec_prompt ?? '',
      iframe_url: mod.content?.iframe_url ?? '',
      iframe_overrides: {
        video: mod.content?.iframe_overrides?.video ?? false,
        resources: mod.content?.iframe_overrides?.resources ?? false,
        recordings: mod.content?.iframe_overrides?.recordings ?? false,
        exec: mod.content?.iframe_overrides?.exec ?? false,
      },
    })
  }

  async function saveEdit(mod: LmsModule) {
    setSaving(true)
    const updatedContent = {
      ...mod.content,
      video_url: editState.video_url || null,
      video_url_extension: editState.video_url_extension || null,
      docs: editState.docs.filter(d => d.title || d.url),
      recordings: editState.recordings.filter(r => r.title || r.url),
      exec_url: editState.exec_url || null,
      exec_prompt: editState.exec_prompt || undefined,
      iframe_url: editState.iframe_url || null,
      iframe_overrides: editState.iframe_url ? editState.iframe_overrides : undefined,
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
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</p>
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
                        <div className="space-y-5">

                          {/* Overview Video */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overview Video</p>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Snippet / Default Video URL</label>
                                <input type="text" value={editState.video_url}
                                  onChange={e => setEditState(s => ({ ...s, video_url: e.target.value }))}
                                  placeholder="https://… (MP4, YouTube, Vimeo, Loom)"
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Extension Install Video URL <span className="text-gray-400">(optional — shows a tab switcher)</span></label>
                                <input type="text" value={editState.video_url_extension}
                                  onChange={e => setEditState(s => ({ ...s, video_url_extension: e.target.value }))}
                                  placeholder="https://… (leave blank if same video)"
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                              </div>
                            </div>
                          </div>

                          {/* Resources */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resources</p>
                              <button
                                onClick={() => setEditState(s => ({ ...s, docs: [...s.docs, { title: '', url: '' }] }))}
                                className="text-xs text-pendo-pink font-semibold hover:underline flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Resource
                              </button>
                            </div>
                            {editState.docs.length === 0 && <p className="text-xs text-gray-400 italic mb-1">No resources yet.</p>}
                            <div className="space-y-2">
                              {editState.docs.map((doc, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <input type="text" value={doc.title}
                                      onChange={e => setEditState(s => ({ ...s, docs: s.docs.map((d, j) => j === i ? { ...d, title: e.target.value } : d) }))}
                                      placeholder="Title"
                                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                    <input type="text" value={doc.url}
                                      onChange={e => setEditState(s => ({ ...s, docs: s.docs.map((d, j) => j === i ? { ...d, url: e.target.value } : d) }))}
                                      placeholder="URL"
                                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                  </div>
                                  <button onClick={() => setEditState(s => ({ ...s, docs: s.docs.filter((_, j) => j !== i) }))}
                                    className="text-gray-400 hover:text-red-500 transition-colors mt-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Recordings */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recordings</p>
                              <button
                                onClick={() => setEditState(s => ({ ...s, recordings: [...s.recordings, { title: '', url: '' }] }))}
                                className="text-xs text-pendo-pink font-semibold hover:underline flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Recording
                              </button>
                            </div>
                            {editState.recordings.length === 0 && <p className="text-xs text-gray-400 italic mb-1">No recordings yet.</p>}
                            <div className="space-y-2">
                              {editState.recordings.map((rec, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <input type="text" value={rec.title}
                                      onChange={e => setEditState(s => ({ ...s, recordings: s.recordings.map((r, j) => j === i ? { ...r, title: e.target.value } : r) }))}
                                      placeholder="Title (e.g. Install Review - Acme)"
                                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                    <input type="text" value={rec.url}
                                      onChange={e => setEditState(s => ({ ...s, recordings: s.recordings.map((r, j) => j === i ? { ...r, url: e.target.value } : r) }))}
                                      placeholder="Zoom / Gong / Loom URL"
                                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                  </div>
                                  <button onClick={() => setEditState(s => ({ ...s, recordings: s.recordings.filter((_, j) => j !== i) }))}
                                    className="text-gray-400 hover:text-red-500 transition-colors mt-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Academy / Iframe Override */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Academy / Iframe Override</p>
                            <p className="text-xs text-gray-400 mb-2">Add an Academy course URL to replace any section with an embedded iframe.</p>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Iframe URL</label>
                                <input type="text" value={editState.iframe_url}
                                  onChange={e => setEditState(s => ({ ...s, iframe_url: e.target.value }))}
                                  placeholder="https://academy.pendo.io/…"
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                              </div>
                              {editState.iframe_url && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-semibold text-amber-800 mb-1">Override sections with this iframe:</p>
                                  {([
                                    { key: 'video', label: 'Overview Video' },
                                    { key: 'resources', label: 'Resources' },
                                    { key: 'recordings', label: 'Customer Recordings' },
                                    { key: 'exec', label: 'exec.com Practice' },
                                  ] as const).map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                                      <div
                                        onClick={() => setEditState(s => ({ ...s, iframe_overrides: { ...s.iframe_overrides, [key]: !s.iframe_overrides[key] } }))}
                                        className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${editState.iframe_overrides[key] ? 'bg-pendo-pink' : 'bg-gray-300'}`}
                                      >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editState.iframe_overrides[key] ? 'translate-x-4' : ''}`} />
                                      </div>
                                      <span className="text-xs text-gray-700">{label}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* exec.com */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">exec.com Practice</p>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Session URL</label>
                                <input type="text" value={editState.exec_url}
                                  onChange={e => setEditState(s => ({ ...s, exec_url: e.target.value }))}
                                  placeholder="https://pendo.exec.com/roleplays/…"
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Practice Prompt</label>
                                <textarea value={editState.exec_prompt}
                                  onChange={e => setEditState(s => ({ ...s, exec_prompt: e.target.value }))}
                                  rows={3}
                                  placeholder="Describe the scenario the learner should practice…"
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink resize-none" />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button onClick={() => saveEdit(mod)} disabled={saving}
                              className="px-4 py-1.5 bg-pendo-pink text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditing(null)}
                              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors">
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
