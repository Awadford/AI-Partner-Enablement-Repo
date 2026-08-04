import { useEffect } from 'react'

interface LinkModalProps {
  url: string
  title: string
  onClose: () => void
}

function getLoomEmbedUrl(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (match) return `https://www.loom.com/embed/${match[1]}`
  return null
}

function getSourceLabel(url: string): string {
  if (url.includes('loom.com')) return 'Loom'
  if (url.includes('zoom.us') || url.includes('pendo.zoom')) return 'Zoom Recording'
  if (url.includes('gong.io')) return 'Gong Recording'
  if (url.includes('docs.google.com/presentation')) return 'Google Slides'
  if (url.includes('docs.google.com/document')) return 'Google Doc'
  if (url.includes('drive.google.com')) return 'Google Drive'
  if (url.includes('academy.pendo.io')) return 'Pendo Academy'
  return 'External Link'
}

function getSourceIcon(url: string): string {
  if (url.includes('loom.com')) return '🎬'
  if (url.includes('zoom.us') || url.includes('pendo.zoom')) return '📹'
  if (url.includes('gong.io')) return '📊'
  if (url.includes('docs.google.com') || url.includes('drive.google.com')) return '📄'
  if (url.includes('academy.pendo.io')) return '🎓'
  return '🔗'
}

export function LinkModal({ url, title, onClose }: LinkModalProps) {
  const loomEmbedUrl = getLoomEmbedUrl(url)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <span className="text-xl">{getSourceIcon(url)}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-pendo-navy text-base leading-snug">{title}</h3>
            <span className="text-xs text-gray-400 mt-0.5 block">{getSourceLabel(url)}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loomEmbedUrl ? (
          <div className="flex-1 relative bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={loomEmbedUrl}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen"
              title={title}
            />
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center justify-center gap-5 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-pendo-navy bg-opacity-5 flex items-center justify-center text-3xl">
              {getSourceIcon(url)}
            </div>
            <div className="text-center">
              <p className="text-pendo-navy font-semibold mb-1">{title}</p>
              <p className="text-gray-500 text-sm max-w-sm">
                {getSourceLabel(url)} recordings can't be embedded — click below to open in a floating player window.
              </p>
            </div>
            <button
              onClick={() => { window.open(url, '_blank'); onClose() }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pendo-pink text-white font-semibold rounded-xl hover:bg-opacity-90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch {getSourceLabel(url)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
