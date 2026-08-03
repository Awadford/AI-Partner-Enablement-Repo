import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../lib/supabase'
import { Layout } from '../../components/Layout'
import { LmsModule, ModuleDoc, ModuleRecording } from '../../types'

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
  const [markedComplete, setMarkedComplete] = useState(false)

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
    }
    load()
  }, [moduleId, profile?.id])

  const currentStatus = moduleId ? progress[moduleId]?.status ?? 'not_started' : 'not_started'
  const isCompleted = currentStatus === 'completed' || markedComplete

  const handleMarkComplete = async () => {
    if (!moduleId) return
    setCompleting(true)
    const ok = await markComplete(moduleId)
    if (ok) setMarkedComplete(true)
    setCompleting(false)
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
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
          <Section
            title="Learn — Overview Video"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            {content.video_url ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={content.video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={module.title}
                />
              </div>
            ) : (
              <div className="aspect-video rounded-lg bg-gray-100 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.263a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Video coming soon</p>
                </div>
              </div>
            )}
          </Section>

          {/* 2. Resources */}
          {docs.length > 0 && (
            <Section
              title="Resources"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
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
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-pendo-pink hover:text-pendo-pink-dark hover:underline transition-colors"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {doc.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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
          {recordings.length > 0 && (
            <Section
              title="Watch — Customer Recordings"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.263a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            >
              <ul className="space-y-3">
                {recordings.map((rec, i) => (
                  <li key={i}>
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-pendo-pink hover:bg-pendo-pink hover:bg-opacity-5 transition-all group"
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
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 5. Record — exec.com prompt */}
          {content.exec_prompt && (
            <Section
              title="Record — Practice with exec.com"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              }
            >
              <p className="text-sm text-gray-600 mb-4">
                Use this prompt to practice your delivery on exec.com — an AI-powered pitch practice platform.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">{content.exec_prompt}</p>
              </div>
              <a
                href="https://exec.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-pendo-navy text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-pendo-navy-light transition-colors"
              >
                Open exec.com
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </Section>
          )}
        </div>

        {/* Mark Complete button */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-pendo-navy transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          {isCompleted ? (
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Module Complete
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={completing}
              className="flex items-center gap-2 bg-pendo-pink text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-pendo-pink-dark transition-colors disabled:opacity-60"
            >
              {completing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark Complete
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Layout>
  )
}
