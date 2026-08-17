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
  synopsis: string
  why_it_matters: string
  video_url: string
  video_url_extension: string
  docs: DocItem[]
  recordings: DocItem[]
  exec_url: string
  exec_prompt: string
  iframe_url: string
  iframe_overrides: IframeOverrides
  academy_courses: { label: string; url: string }[]
}

type UploadMode = 'url' | 'upload'

const CATEGORIES: { key: 'delivery' | 'product' | 'services' | 'gtm'; label: string; dot: string }[] = [
  { key: 'delivery', label: 'Delivery',  dot: 'bg-blue-500' },
  { key: 'product',  label: 'Product',   dot: 'bg-purple-500' },
  { key: 'services', label: 'Services',  dot: 'bg-orange-500' },
  { key: 'gtm',      label: 'GTM',       dot: 'bg-green-500' },
]

interface NewModuleForm {
  title: string
  description: string
  category: 'delivery' | 'product' | 'services' | 'gtm'
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function AdminModules() {
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showAddModule, setShowAddModule] = useState(false)
  const [newModule, setNewModule] = useState<NewModuleForm>({ title: '', description: '', category: 'delivery' })
  const [addingSaving, setAddingSaving] = useState(false)
  const [editState, setEditState] = useState<EditState>({
    synopsis: '', why_it_matters: '',
    video_url: '', video_url_extension: '', docs: [], recordings: [],
    exec_url: '', exec_prompt: '', iframe_url: '',
    iframe_overrides: { video: false, resources: false, recordings: false, exec: false },
    academy_courses: [],
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [videoUploadMode, setVideoUploadMode] = useState<UploadMode>('url')
  const [videoExtUploadMode, setVideoExtUploadMode] = useState<UploadMode>('url')
  const [uploading, setUploading] = useState<'main' | 'ext' | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['delivery', 'product', 'services', 'gtm'])
  )

  async function loadModules() {
    const { data } = await supabase.from('lms_modules').select('*').order('default_order')
    setModules((data ?? []) as LmsModule[])
    setLoading(false)
  }

  useEffect(() => { loadModules() }, [])

  async function addModule(e: React.FormEvent) {
    e.preventDefault()
    setAddingSaving(true)
    const catModules = modules.filter(m => m.category === newModule.category)
    const maxOrder = catModules.reduce((max, m) => Math.max(max, m.default_order), 0)
    const slug = slugify(newModule.title) || `module-${Date.now()}`
    const { data, error } = await supabase.from('lms_modules').insert([{
      title: newModule.title,
      description: newModule.description,
      category: newModule.category,
      slug,
      default_order: maxOrder + 1,
      content: {},
    }]).select().single()
    if (!error && data) {
      setModules(prev => [...prev, data as LmsModule])
      setShowAddModule(false)
      setNewModule({ title: '', description: '', category: 'delivery' })
      // Auto-expand the new module's category and the module itself
      setExpandedCategories(prev => new Set([...prev, newModule.category]))
      setExpanded((data as LmsModule).id)
      startEdit(data as LmsModule)
    }
    setAddingSaving(false)
  }

  async function uploadVideo(file: File, field: 'video_url' | 'video_url_extension') {
    const MAX_MB = 50
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File too large — max ${MAX_MB}MB. Try compressing the video first.`)
      return
    }
    setUploadError(null)
    setUploading(field === 'video_url' ? 'main' : 'ext')
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-').toLowerCase()
    const path = `${Date.now()}-${safeName}`
    const { data, error } = await supabase.storage
      .from('pal-videos')
      .upload(path, file, { contentType: 'video/mp4', upsert: false })
    if (error) {
      setUploadError(error.message)
    } else if (data) {
      const { data: urlData } = supabase.storage.from('pal-videos').getPublicUrl(data.path)
      setEditState(s => ({ ...s, [field]: urlData.publicUrl }))
      if (field === 'video_url') setVideoUploadMode('url')
      else setVideoExtUploadMode('url')
    }
    setUploading(null)
  }

  async function startEdit(mod: LmsModule) {
    const { data: fresh } = await supabase.from('lms_modules').select('*').eq('id', mod.id).single()
    const m = (fresh as LmsModule) ?? mod
    setEditing(m.id)
    setVideoUploadMode('url')
    setVideoExtUploadMode('url')
    setUploadError(null)
    setEditState({
      synopsis: m.content?.synopsis ?? '',
      why_it_matters: m.content?.why_it_matters ?? '',
      video_url: m.content?.video_url ?? '',
      video_url_extension: m.content?.video_url_extension ?? '',
      docs: m.content?.docs?.map((d: DocItem) => ({ ...d })) ?? [],
      recordings: m.content?.recordings?.map((r: DocItem) => ({ ...r })) ?? [],
      exec_url: m.content?.exec_url ?? '',
      exec_prompt: m.content?.exec_prompt ?? '',
      iframe_url: m.content?.iframe_url ?? '',
      iframe_overrides: {
        video: m.content?.iframe_overrides?.video ?? false,
        resources: m.content?.iframe_overrides?.resources ?? false,
        recordings: m.content?.iframe_overrides?.recordings ?? false,
        exec: m.content?.iframe_overrides?.exec ?? false,
      },
      academy_courses: m.content?.academy_courses?.map((c: { label: string; url: string }) => ({ ...c })) ?? [],
    })
  }

  async function saveEdit(mod: LmsModule) {
    setSaving(true)
    const updatedContent = {
      ...mod.content,
      synopsis: editState.synopsis || undefined,
      why_it_matters: editState.why_it_matters || undefined,
      video_url: editState.video_url || null,
      video_url_extension: editState.video_url_extension || null,
      docs: editState.docs.filter(d => d.title || d.url),
      recordings: editState.recordings.filter(r => r.title || r.url),
      exec_url: editState.exec_url || null,
      exec_prompt: editState.exec_prompt || undefined,
      iframe_url: editState.iframe_url || null,
      academy_courses: editState.academy_courses.filter(c => c.url),
      iframe_overrides: editState.academy_courses.some(c => c.url) || editState.iframe_url
        ? editState.iframe_overrides
        : undefined,
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

  const toggleCategory = (key: string) => setExpandedCategories(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const modulesByCategory = Object.fromEntries(
    CATEGORIES.map(c => [c.key, modules.filter(m => m.category === c.key)])
  )

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-pendo-navy">Module Catalog</h1>
            <p className="text-gray-500 mt-1">{modules.length} modules across 4 categories</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {saveMsg && (
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${saveMsg === 'Saved!' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={() => setShowAddModule(true)}
              className="px-4 py-2 bg-pendo-pink text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Module
            </button>
          </div>
        </div>

        {/* Add Module Modal */}
        {showAddModule && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-pendo-navy mb-4">Add Module</h2>
              <form onSubmit={addModule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <label key={cat.key} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors
                        ${newModule.category === cat.key ? 'border-pendo-pink bg-pink-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="category"
                          value={cat.key}
                          checked={newModule.category === cat.key}
                          onChange={() => setNewModule(f => ({ ...f, category: cat.key }))}
                          className="sr-only"
                        />
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cat.dot}`} />
                        <span className={`text-sm font-medium ${newModule.category === cat.key ? 'text-pendo-pink' : 'text-gray-700'}`}>{cat.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Module Title *</label>
                  <input
                    type="text"
                    required
                    value={newModule.title}
                    onChange={e => setNewModule(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Advanced Segmentation"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newModule.description}
                    onChange={e => setNewModule(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Brief one-line description shown on the learner dashboard"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={addingSaving}
                    className="flex-1 py-2 bg-pendo-pink text-white font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors text-sm">
                    {addingSaving ? 'Creating…' : 'Create Module'}
                  </button>
                  <button type="button" onClick={() => setShowAddModule(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map(cat => {
              const catModules = modulesByCategory[cat.key] ?? []
              const isOpen = expandedCategories.has(cat.key)
              return (
                <div key={cat.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.key)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cat.dot}`} />
                    <span className="font-semibold text-pendo-navy text-base flex-1">{cat.label}</span>
                    <span className="text-sm text-gray-400 mr-2">{catModules.length} module{catModules.length !== 1 ? 's' : ''}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Modules list */}
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {catModules.length === 0 ? (
                        <p className="text-sm text-gray-400 italic px-5 py-4">No modules in this category yet.</p>
                      ) : catModules.map(mod => (
                        <div key={mod.id}>
                          {/* Module row */}
                          <button
                            onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-pendo-navy text-sm">{mod.title}</p>
                              {mod.description && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{mod.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {mod.content?.video_url && <span className="text-xs text-gray-400">Video ✓</span>}
                              {(mod.content?.academy_courses?.length ?? 0) > 0 && <span className="text-xs text-gray-400">Academy ✓</span>}
                              {mod.content?.docs && mod.content.docs.length > 0 && (
                                <span className="text-xs text-gray-400">{mod.content.docs.length} doc{mod.content.docs.length !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded === mod.id ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Module detail / edit */}
                          {expanded === mod.id && (
                            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                              {/* Stats */}
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
                                  <div className="text-xl font-bold text-pendo-navy">{mod.content?.exec_url ? '✓' : '—'}</div>
                                  <div className="text-xs text-gray-500">exec.com</div>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <div className="text-xl font-bold text-pendo-navy">{mod.content?.video_url ? '✓' : '—'}</div>
                                  <div className="text-xs text-gray-500">Video</div>
                                </div>
                              </div>

                              {/* Content edit panel */}
                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</p>
                                  {editing !== mod.id && (
                                    <button onClick={() => startEdit(mod)} className="text-xs text-pendo-pink font-semibold hover:underline">Edit</button>
                                  )}
                                </div>

                                {editing === mod.id ? (
                                  <div className="space-y-5">
                                    {/* Synopsis & Why It Matters */}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overview</p>
                                      <div className="space-y-2">
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Synopsis</label>
                                          <textarea value={editState.synopsis}
                                            onChange={e => setEditState(s => ({ ...s, synopsis: e.target.value }))}
                                            rows={3}
                                            placeholder="Brief description of what this module covers…"
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink resize-none" />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Why It Matters / Key Outcomes</label>
                                          <textarea value={editState.why_it_matters}
                                            onChange={e => setEditState(s => ({ ...s, why_it_matters: e.target.value }))}
                                            rows={3}
                                            placeholder="Business outcomes, customer examples, key buyer personas…"
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink resize-none" />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Overview Video */}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overview Video</p>
                                      {uploadError && (
                                        <p className="text-xs text-red-600 mb-2">{uploadError}</p>
                                      )}
                                      <div className="space-y-3">
                                        {/* Main video */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-gray-500">Snippet / Default Video</label>
                                            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-md">
                                              {(['url', 'upload'] as UploadMode[]).map(m => (
                                                <button key={m} type="button"
                                                  onClick={() => { setVideoUploadMode(m); setUploadError(null) }}
                                                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${videoUploadMode === m ? 'bg-white shadow-sm text-pendo-navy' : 'text-gray-500'}`}>
                                                  {m === 'url' ? '🔗 URL' : '📁 Upload MP4'}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          {videoUploadMode === 'url' ? (
                                            <input type="text" value={editState.video_url}
                                              onChange={e => setEditState(s => ({ ...s, video_url: e.target.value }))}
                                              placeholder="https://… (YouTube, Vimeo, Loom, or MP4 URL)"
                                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                          ) : (
                                            <div className="flex items-center gap-3">
                                              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium
                                                ${uploading === 'main' ? 'border-pendo-pink bg-pink-50 text-pendo-pink cursor-not-allowed' : 'border-gray-300 hover:border-pendo-pink hover:text-pendo-pink text-gray-500'}`}>
                                                {uploading === 'main' ? (
                                                  <><div className="w-4 h-4 border-2 border-pendo-pink border-t-transparent rounded-full animate-spin" />Uploading…</>
                                                ) : (
                                                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Choose MP4 (max 50MB)</>
                                                )}
                                                <input type="file" accept="video/mp4,video/webm" disabled={!!uploading}
                                                  className="sr-only"
                                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f, 'video_url') }} />
                                              </label>
                                              {editState.video_url && (
                                                <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Uploaded</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {/* Extension video */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-gray-500">Extension Install Video <span className="text-gray-400">(optional)</span></label>
                                            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-md">
                                              {(['url', 'upload'] as UploadMode[]).map(m => (
                                                <button key={m} type="button"
                                                  onClick={() => { setVideoExtUploadMode(m); setUploadError(null) }}
                                                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${videoExtUploadMode === m ? 'bg-white shadow-sm text-pendo-navy' : 'text-gray-500'}`}>
                                                  {m === 'url' ? '🔗 URL' : '📁 Upload MP4'}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          {videoExtUploadMode === 'url' ? (
                                            <input type="text" value={editState.video_url_extension}
                                              onChange={e => setEditState(s => ({ ...s, video_url_extension: e.target.value }))}
                                              placeholder="https://… (leave blank if same as above)"
                                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                          ) : (
                                            <div className="flex items-center gap-3">
                                              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium
                                                ${uploading === 'ext' ? 'border-pendo-pink bg-pink-50 text-pendo-pink cursor-not-allowed' : 'border-gray-300 hover:border-pendo-pink hover:text-pendo-pink text-gray-500'}`}>
                                                {uploading === 'ext' ? (
                                                  <><div className="w-4 h-4 border-2 border-pendo-pink border-t-transparent rounded-full animate-spin" />Uploading…</>
                                                ) : (
                                                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Choose MP4 (max 50MB)</>
                                                )}
                                                <input type="file" accept="video/mp4,video/webm" disabled={!!uploading}
                                                  className="sr-only"
                                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f, 'video_url_extension') }} />
                                              </label>
                                              {editState.video_url_extension && (
                                                <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Uploaded</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Resources */}
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resources</p>
                                        <button onClick={() => setEditState(s => ({ ...s, docs: [...s.docs, { title: '', url: '' }] }))}
                                          className="text-xs text-pendo-pink font-semibold hover:underline flex items-center gap-1">
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
                                        <button onClick={() => setEditState(s => ({ ...s, recordings: [...s.recordings, { title: '', url: '' }] }))}
                                          className="text-xs text-pendo-pink font-semibold hover:underline flex items-center gap-1">
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

                                    {/* Academy Courses */}
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Academy Courses</p>
                                        <button onClick={() => setEditState(s => ({ ...s, academy_courses: [...s.academy_courses, { label: '', url: '' }] }))}
                                          className="text-xs text-pendo-pink font-semibold hover:underline flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                          Add Course
                                        </button>
                                      </div>
                                      {editState.academy_courses.length === 0 && (
                                        <p className="text-xs text-gray-400 italic mb-2">No Academy courses yet.</p>
                                      )}
                                      <div className="space-y-2 mb-3">
                                        {editState.academy_courses.map((course, i) => (
                                          <div key={i} className="flex gap-2 items-start">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                              <input type="text" value={course.label}
                                                onChange={e => setEditState(s => ({ ...s, academy_courses: s.academy_courses.map((c, j) => j === i ? { ...c, label: e.target.value } : c) }))}
                                                placeholder="Course label"
                                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                              <input type="text" value={course.url}
                                                onChange={e => setEditState(s => ({ ...s, academy_courses: s.academy_courses.map((c, j) => j === i ? { ...c, url: e.target.value } : c) }))}
                                                placeholder="https://pendo.docebosaas.com/…"
                                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pendo-pink" />
                                            </div>
                                            <button onClick={() => setEditState(s => ({ ...s, academy_courses: s.academy_courses.filter((_, j) => j !== i) }))}
                                              className="text-gray-400 hover:text-red-500 transition-colors mt-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      {editState.academy_courses.some(c => c.url) && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                          <p className="text-xs font-medium text-amber-800 mb-2">Which sections should show Academy Courses?</p>
                                          <div className="grid grid-cols-2 gap-2">
                                            {([
                                              { key: 'video', label: 'Overview Video' },
                                              { key: 'resources', label: 'Resources' },
                                              { key: 'recordings', label: 'Customer Recordings' },
                                              { key: 'exec', label: 'exec.com Practice' },
                                            ] as const).map(({ key, label }) => (
                                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox"
                                                  checked={editState.iframe_overrides[key]}
                                                  onChange={e => setEditState(s => ({ ...s, iframe_overrides: { ...s.iframe_overrides, [key]: e.target.checked } }))}
                                                  className="rounded border-amber-300 text-pendo-pink focus:ring-pendo-pink" />
                                                <span className="text-xs text-amber-800">{label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      )}
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
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
