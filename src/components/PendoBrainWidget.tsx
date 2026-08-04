import { useState } from 'react'

const SLACK_PENDO_BRAIN_URL = 'https://pendo-internal.slack.com/app_redirect?app=pendo-brain'

export function PendoBrainWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center overflow-hidden"
        title="Ask Pendo Brain"
        style={{ background: 'linear-gradient(135deg, #1a1c3e 0%, #e8185a 100%)' }}
      >
        {/* Pendo Brain Dino SVG */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Simple dino/brain silhouette */}
          <circle cx="16" cy="10" r="7" fill="white" fillOpacity="0.9"/>
          <path d="M10 13 Q8 18 10 22 L14 24 L18 24 L22 22 Q24 18 22 13" fill="white" fillOpacity="0.9"/>
          <circle cx="13" cy="9" r="1.5" fill="#e8185a"/>
          <circle cx="19" cy="9" r="1.5" fill="#e8185a"/>
          <path d="M13 12.5 Q16 14 19 12.5" stroke="#1a1c3e" strokeWidth="1" strokeLinecap="round" fill="none"/>
          {/* Brain squiggle on top */}
          <path d="M11 6 Q12 4 14 5 Q15 3 17 4 Q19 3 20 5 Q22 4 22 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          {/* Tiny arms */}
          <path d="M10 17 L7 15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M22 17 L25 15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          {/* Tiny tail */}
          <path d="M14 24 Q13 27 11 28" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in">
          {/* Header */}
          <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #1a1c3e 0%, #2d2f5e 100%)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="10" r="7" fill="white" fillOpacity="0.9"/>
                <path d="M10 13 Q8 18 10 22 L14 24 L18 24 L22 22 Q24 18 22 13" fill="white" fillOpacity="0.9"/>
                <circle cx="13" cy="9" r="1.5" fill="#e8185a"/>
                <circle cx="19" cy="9" r="1.5" fill="#e8185a"/>
                <path d="M11 6 Q12 4 14 5 Q15 3 17 4 Q19 3 20 5 Q22 4 22 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Pendo Brain</p>
              <p className="text-blue-200 text-xs">Your AI enablement assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white text-opacity-60 hover:text-opacity-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Ask Pendo Brain anything about Pendo — implementation questions, best practices, product guidance, and more.
            </p>
            <div className="space-y-2 mb-4">
              {[
                'How do I install Pendo on a SPA?',
                'What\'s the best tagging strategy?',
                'How do I build an NPS guide?',
              ].map(q => (
                <a
                  key={q}
                  href={SLACK_PENDO_BRAIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
                >
                  "{q}"
                </a>
              ))}
            </div>
            <a
              href={SLACK_PENDO_BRAIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors"
              style={{ background: 'linear-gradient(135deg, #e8185a 0%, #c01348 100%)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Open in Slack
            </a>
          </div>
        </div>
      )}
    </>
  )
}
