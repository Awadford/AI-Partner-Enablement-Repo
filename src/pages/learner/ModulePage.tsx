import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { LinkModal } from '../../components/LinkModal'
import { StepGuide } from '../../components/StepGuide'
import { LmsModule, ModuleDoc, ModuleRecording } from '../../types'

/** Returns true for content we can embed in an in-app iframe */
function isEmbeddable(url: string): boolean {
  return /loom\.com|youtube\.com|youtu\.be|vimeo\.com|wistia\.(com|net)/i.test(url)
}

// Detects whether a URL is an embeddable video or a link-only source
function VideoPlayer({ url, title, onOpenModal: _onOpenModal }: { url: string; title: string; onOpenModal: (url: string, title: string) => void }) {
  const isLoom = /loom\.com/i.test(url)
  const isYouTube = /youtube\.com|youtu\.be/i.test(url)
  const isVimeo = /vimeo\.com/i.test(url)
  const isWistia = /wistia\.(com|net)/i.test(url)
  const isLinkOnly = /zoom\.us|pendo\.zoom|gong\.io/i.test(url)

  // Non-embeddable sources — open directly in new tab
  if (isLinkOnly) {
    const label = /gong\.io/i.test(url) ? 'Gong Recording' : 'Zoom Recording'
    const icon = /gong\.io/i.test(url) ? '📊' : '📹'
    return (
      <button
        onClick={() => window.open(url, '_blank')}
        className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-pendo-pink hover:bg-pink-50 transition-all group"
      >
        <span className="text-3xl">{icon}</span>
        <div className="text-left">
          <p className="font-semibold text-pendo-navy group-hover:text-pendo-pink transition-colors">{label}</p>
          <p className="text-sm text-gray-500 mt-0.5">Click to open in new tab</p>
        </div>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-pendo-pink ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </button>
    )
  }

  if (isLoom || isYouTube || isVimeo || isWistia) {
    let embedUrl = url
    if (isYouTube) {
      if (url.includes('youtube.com/watch')) {
        const videoId = new URL(url).searchParams.get('v')
        if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`
      } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0]
        if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`
      }
    } else if (isLoom) {
      const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
      if (match) embedUrl = `https://www.loom.com/embed/${match[1]}`
    }
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    )
  }

  // Direct MP4 / file URL — use native <video> with src directly on element (not <source>) so React remounts reliably
  return (
    <div className="rounded-lg overflow-hidden bg-black">
      <video key={url} src={url} controls className="w-full" style={{ maxHeight: '480px' }} preload="metadata" />
    </div>
  )
}

function VideoTabs({
  snippet, extension, onOpenModal
}: {
  snippet: { url: string; title: string }
  extension: { url: string; title: string }
  onOpenModal: (url: string, title: string) => void
}) {
  const [active, setActive] = useState<'snippet' | 'extension'>('snippet')
  const current = active === 'snippet' ? snippet : extension
  return (
    <div>
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
        {(['snippet', 'extension'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === tab
                ? 'bg-white text-pendo-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'snippet' ? '1st Party Snippet' : 'Browser Extension'}
          </button>
        ))}
      </div>
      <VideoPlayer key={current.url} url={current.url} title={current.title} onOpenModal={onOpenModal} />
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="w-8 h-8 rounded-lg bg-pendo-pink bg-opacity-10 flex items-center justify-center text-pendo-pink">
          {icon}
        </div>
        <h2 className="font-semibold text-pendo-navy text-base">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const { profile } = useAuth()
  const { progress, markComplete, markInProgress } = useProgress(profile?.id ?? null)
  const navigate = useNavigate()

  const [module, setModule] = useState<LmsModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [docsOpen, setDocsOpen] = useState(true)
  const [expandedHtmlDoc, setExpandedHtmlDoc] = useState<number | null>(null)
  const [markedComplete, setMarkedComplete] = useState(false)
  const [modalLink, setModalLink] = useState<{ url: string; title: string } | null>(null)
  const [execPassed, setExecPassed] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(0)
  const [nextModuleId, setNextModuleId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!moduleId) return
      const { data, error } = await supabase
        .from('lms_modules')
        .select('*')
        .eq('id', moduleId)
        .single()

      if (error || !data) {
        navigate('/dashboard')
        return
      }
      setModule(data as LmsModule)
      setLoading(false)

      // Mark in progress
      if (profile?.id) {
        await markInProgress(moduleId)
      }

      // Find next module in this partner's learning path
      if (profile?.partner_id) {
        const { data: pms } = await supabase
          .from('lms_partner_modules')
          .select('module_id, order_index')
          .eq('partner_id', profile.partner_id)
          .eq('enabled', true)
          .order('order_index')
        if (pms) {
          const idx = pms.findIndex(pm => pm.module_id === moduleId)
          setNextModuleId(pms[idx + 1]?.module_id ?? null)
        }
      }
    }
    load()
  }, [moduleId, profile?.id])

  // Listen for exec.com postMessage completion events
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      const data = e.data
      const isPassed =
        data?.type === 'scenario_complete' ||
        data?.type === 'session_complete' ||
        data?.type === 'roleplay_complete' ||
        data?.event === 'complete' ||
        data?.status === 'passed' ||
        data?.status === 'completed'
      if (isPassed && moduleId) {
        setCompleting(true)
        const ok = await markComplete(moduleId)
        if (ok) {
          setMarkedComplete(true)
          setExecPassed(true)
          // singleIframeMode (academy course) auto-navigates; exec scenario modules wait for user click
        }
        setCompleting(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [moduleId])

  const currentStatus = moduleId ? progress[moduleId]?.status ?? 'not_started' : 'not_started'
  const isCompleted = currentStatus === 'completed' || markedComplete

  const handleMarkComplete = async () => {
    if (!moduleId) return
    setCompleting(true)
    const ok = await markComplete(moduleId)
    if (ok) setMarkedComplete(true)
    setCompleting(false)
  }

  const handleContinue = () => {
    navigate(nextModuleId ? `/module/${nextModuleId}` : '/dashboard')
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pendo-pink"></div>
        </div>
      </Layout>
    )
  }

  if (!module) return null

  const content = module.content ?? {}
  const docs: ModuleDoc[] = content.docs ?? []
  const recordings: ModuleRecording[] = content.recordings ?? []
  const academyCourses: { label: string; url: string }[] = content.academy_courses ?? []
  const overrides = content.iframe_overrides ?? {}
  const hasAcademy = academyCourses.length > 0
  // Determine course provider from URLs for labelling
  const isExecCourse = academyCourses.some(c => c.url.includes('exec.com'))
  const courseBlockLabel = isExecCourse ? 'Exec Course' : 'Academy Course'
  // Legacy fallback: per-section or single iframe URL
  const legacyIframeUrls = content.iframe_urls ?? {}
  const legacyIframeUrl = content.iframe_url
  const legacyOverrides = content.iframe_overrides ?? {}
  const sectionIframe = (section: 'video' | 'resources' | 'recordings' | 'exec'): string | null =>
    legacyIframeUrls[section] || (legacyOverrides[section] ? legacyIframeUrl ?? null : null)
  // Only ONE section shows the academy/exec block — the first enabled one by priority
  const academySectionOrder = ['exec', 'video', 'resources', 'recordings'] as const
  const academyTargetSection = hasAcademy
    ? academySectionOrder.find(s => !!overrides[s]) ?? null
    : null
  const isAcademySection = (section: 'video' | 'resources' | 'recordings' | 'exec') =>
    academyTargetSection === section

  // Detect when the iframe is the only content section — used to expand it to fill the page
  const hasVideoSection = !!(content.video_url || content.video_url_extension || isAcademySection('video') || sectionIframe('video'))
  const hasResourcesSection = docs.length > 0 || isAcademySection('resources') || !!sectionIframe('resources')
  const hasScenarioSection = !!content.scenario
  const hasRecordingsSection = recordings.length > 0 || isAcademySection('recordings') || !!sectionIframe('recordings')
  const hasStepGuideSection = !!content.step_guide
  const singleIframeMode = hasAcademy && !hasVideoSection && !hasResourcesSection && !hasScenarioSection && !hasRecordingsSection && !hasStepGuideSection && !content.exec_url

  // Renders the Academy/iframe embed used when a section is overridden
  const IframeEmbed = ({ title, url, height = '560px', embedTimeout = 20000 }: { title: string; url: string; height?: string; embedTimeout?: number }) => {
    const [failed, setFailed] = useState(false)
    // Detect embed block via timeout — X-Frame-Options errors don't fire onError on iframes
    const [timedOut, setTimedOut] = useState(false)
    const [loaded, setLoaded] = useState(false)
    useEffect(() => {
      const t = setTimeout(() => { if (!loaded) setTimedOut(true) }, embedTimeout)
      return () => clearTimeout(t)
    }, [loaded])
    const blocked = failed || timedOut
    if (blocked) {
      return (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-pendo-navy bg-opacity-5 flex items-center justify-center text-2xl">🎓</div>
          <div>
            <p className="font-semibold text-pendo-navy mb-1">{title}</p>
            <p className="text-sm text-gray-500 max-w-xs">This content can't be embedded — click below to open it in a new tab.</p>
          </div>
          <button
            onClick={() => window.open(url, '_blank')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-pendo-pink text-white font-semibold rounded-xl hover:bg-opacity-90 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Course
          </button>
        </div>
      )
    }
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 relative" style={{ height }}>
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pendo-pink" />
            <p className="text-sm text-gray-400">Loading course…</p>
          </div>
        )}
        <iframe
          src={url}
          title={title}
          className="w-full h-full"
          allow="fullscreen; autoplay"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  // Academy Courses block — dropdown + iframe, shown wherever sections are overridden
  const AcademyCoursesBlock = () => {
    const course = academyCourses[selectedCourse] ?? academyCourses[0]
    if (!course) return null
    return (
      <div>
        {academyCourses.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Select a course</label>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(Number(e.target.value))}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pendo-pink bg-white"
            >
              {academyCourses.map((c, i) => (
                <option key={i} value={i}>{c.label || `Course ${i + 1}`}</option>
              ))}
            </select>
          </div>
        )}
        {academyCourses.length === 1 && (
          <p className="text-sm font-medium text-pendo-navy mb-3">{course.label}</p>
        )}
        <IframeEmbed title={course.label || module!.title} url={course.url} height={singleIframeMode ? 'calc(100vh - 320px)' : '560px'} embedTimeout={singleIframeMode ? 60000 : 20000} />
      </div>
    )
  }

  return (
    <Layout>
      <div className={`${singleIframeMode ? 'max-w-none px-4 sm:px-8' : 'max-w-3xl px-4 sm:px-6'} mx-auto py-8`}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/dashboard" className="hover:text-pendo-pink transition-colors">My Learning Path</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-pendo-navy font-medium">{module.title}</span>
        </div>

        {/* Module header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-pendo-pink bg-opacity-10 text-pendo-pink capitalize">
                  {module.category}
                </span>
                {isCompleted && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                    Completed
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-pendo-navy mb-3">{module.title}</h1>
              {content.why_it_matters && (
                <div className="bg-pendo-navy bg-opacity-5 rounded-lg p-4 mb-3 border-l-4 border-pendo-pink">
                  <p className="text-sm font-medium text-pendo-navy mb-1">Why It Matters</p>
                  <p className="text-sm text-gray-700">{content.why_it_matters}</p>
                </div>
              )}
              {content.synopsis && (
                <p className="text-gray-600 text-sm leading-relaxed">{content.synopsis}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. Learn — Video */}
          {(content.video_url || content.video_url_extension || isAcademySection('video') || sectionIframe('video')) && (
          <Section
            title={isAcademySection('video') || sectionIframe('video') ? courseBlockLabel : 'Learn — Overview Video'}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            {isAcademySection('video') ? (
              <AcademyCoursesBlock />
            ) : sectionIframe('video') ? (
              <IframeEmbed title={`${module.title} — Academy Course`} url={sectionIframe('video')!} />
            ) : content.video_url ? (
              content.video_url_extension ? (
                // Two install paths — tabbed
                <VideoTabs
                  snippet={{ url: content.video_url, title: 'Snippet Install' }}
                  extension={{ url: content.video_url_extension, title: 'Extension Install' }}
                  onOpenModal={(url, t) => setModalLink({ url, title: t })}
                />
              ) : (
                <VideoPlayer url={content.video_url} title={module.title} onOpenModal={(url, t) => setModalLink({ url, title: t })} />
              )
            ) : null}
          </Section>
          )}

          {/* 2. Resources */}
          {(docs.length > 0 || isAcademySection('resources') || sectionIframe('resources')) && (
            <Section
              title={isAcademySection('resources') || sectionIframe('resources') ? courseBlockLabel : 'Resources'}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              {isAcademySection('resources') ? (
                <AcademyCoursesBlock />
              ) : sectionIframe('resources') ? (
                <IframeEmbed title={`${module.title} — Resources`} url={sectionIframe('resources')!} />
              ) : (<>
              <button
                onClick={() => setDocsOpen(o => !o)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-pendo-navy mb-3 transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${docsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {docsOpen ? 'Hide' : 'Show'} {docs.length} document{docs.length !== 1 ? 's' : ''}
              </button>
              {docsOpen && (
                <ul className="space-y-2">
                  {docs.map((doc, i) => (
                    <li key={i}>
                      {doc.html ? (
                        <div>
                          <button
                            onClick={() => setExpandedHtmlDoc(expandedHtmlDoc === i ? null : i)}
                            className="flex items-center gap-2 text-sm text-pendo-pink hover:text-pendo-pink-dark hover:underline transition-colors text-left"
                          >
                            <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedHtmlDoc === i ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {doc.title}
                          </button>
                          {expandedHtmlDoc === i && (
                            <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                              <iframe
                                srcDoc={doc.html}
                                title={doc.title}
                                className="w-full"
                                style={{ height: '600px', border: 'none' }}
                                sandbox="allow-scripts allow-same-origin"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => isEmbeddable(doc.url) ? setModalLink({ url: doc.url, title: doc.title }) : window.open(doc.url, '_blank')}
                          className="flex items-center gap-2 text-sm text-pendo-pink hover:text-pendo-pink-dark hover:underline transition-colors text-left"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {doc.title}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              </>)}
            </Section>
          )}

          {/* 3. Do — Scenario */}
          {content.scenario && (
            <Section
              title="Do — Practice Scenario"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
            >
              <div className="bg-gradient-to-br from-pendo-navy to-pendo-navy-light rounded-xl p-6 text-white">
                <h3 className="font-semibold text-lg mb-2">{content.scenario.title}</h3>
                <p className="text-gray-200 text-sm leading-relaxed mb-5">{content.scenario.description}</p>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 bg-pendo-pink hover:bg-pendo-pink-dark px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Start Scenario
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </Section>
          )}

          {/* 4. Watch — Customer Recordings */}
          {(recordings.length > 0 || isAcademySection('recordings') || sectionIframe('recordings')) && (
            <Section
              title={isAcademySection('recordings') || sectionIframe('recordings') ? courseBlockLabel : 'Watch — Customer Recordings'}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.263a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            >
              {isAcademySection('recordings') ? (
                <AcademyCoursesBlock />
              ) : sectionIframe('recordings') ? (
                <IframeEmbed title={`${module.title} — Recordings`} url={sectionIframe('recordings')!} />
              ) : (
              <ul className="space-y-3">
                {recordings.map((rec, i) => (
                  <li key={i}>
                    <button
                      onClick={() => isEmbeddable(rec.url) ? setModalLink({ url: rec.url, title: rec.title }) : window.open(rec.url, '_blank')}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-pendo-pink hover:bg-pendo-pink hover:bg-opacity-5 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-pendo-pink bg-opacity-10 flex items-center justify-center text-pendo-pink flex-shrink-0">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-pendo-navy font-medium">{rec.title}</span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-pendo-pink ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              )}
            </Section>
          )}

          {/* Step Guide */}
          {content.step_guide && (
            <Section
              title="Step by Step"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            >
              <StepGuide guide={content.step_guide} />
            </Section>
          )}

          {/* 5. Record — exec.com */}
          {((content.exec_url || (content.exec_prompt && content.exec_url)) || isAcademySection('exec') || sectionIframe('exec')) && (
            singleIframeMode ? (
              // Full-width, no card chrome — iframe fills the remaining viewport
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <AcademyCoursesBlock />
              </div>
            ) : (
            <Section
              title={isAcademySection('exec') || sectionIframe('exec') ? courseBlockLabel : 'Record — Practice with exec.com'}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              }
            >
              {isAcademySection('exec') ? (
                <AcademyCoursesBlock />
              ) : sectionIframe('exec') ? (
                <IframeEmbed title={`${module.title} — Practice`} url={sectionIframe('exec')!} />
              ) : (<>
              {/* Prompt shown above the iframe if present */}
              {content.exec_prompt && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-pendo-navy mb-2">Your practice prompt:</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{content.exec_prompt}</p>
                  </div>
                </div>
              )}
              {/* Inline exec.com iframe — fills the section */}
              <IframeEmbed
                title={`${module.title} — Practice Scenario`}
                url={content.exec_url!}
                height="calc(80vh)"
                embedTimeout={60000}
              />
              </>)}
            </Section>
            )
          )}
        </div>

        {/* Completion footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-pendo-navy transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>

          {/* Exec-gated modules (includes singleIframeMode academy courses) */}
          {(content.exec_url || singleIframeMode) ? (
            isCompleted || execPassed ? (
              // Passed — Continue button active
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 bg-pendo-pink text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
                >
                  {completing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {nextModuleId ? 'Continue to Next Module' : 'Back to Dashboard'}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
                <p className="text-xs text-green-600 font-medium">Scenario passed ✓</p>
              </div>
            ) : (
              // Not yet passed — locked Continue button
              <div className="flex flex-col items-end gap-1">
                <button
                  disabled
                  className="flex items-center gap-2 bg-gray-200 text-gray-400 px-6 py-2.5 rounded-lg font-semibold cursor-not-allowed"
                >
                  {nextModuleId ? 'Continue to Next Module' : 'Back to Dashboard'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
                <p className="text-xs text-gray-400">Pass the scenario above to continue</p>
              </div>
            )
          ) : (
            // Non-exec modules: standard mark complete → Continue
            isCompleted ? (
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 bg-pendo-pink text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {nextModuleId ? 'Continue to Next Module' : 'Back to Dashboard'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="flex items-center gap-2 bg-pendo-pink text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-60"
              >
                {completing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Mark Complete</>
                )}
              </button>
            )
          )}
        </div>
      </div>


      {/* Link modal */}
      {modalLink && (
        <LinkModal url={modalLink.url} title={modalLink.title} onClose={() => setModalLink(null)} />
      )}
    </Layout>
  )
}
