import { useState } from 'react'

const SLACK_PENDO_BRAIN_URL = 'https://pendo-internal.slack.com/app_redirect?app=pendo-brain'

export function PendoBrainWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 overflow-hidden p-0 border-0"
        title="Ask Pendo Brain"
      >
        <img src="/pendo-brain-icon.png" alt="Pendo Brain" className="w-full h-full object-cover" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in">
          {/* Header */}
          <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #1a1c3e 0%, #2d2f5e 100%)' }}>
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <img src="/pendo-brain-icon.png" alt="Pendo Brain" className="w-full h-full object-cover" />
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
                <button
                  key={q}
                  onClick={() => window.open(SLACK_PENDO_BRAIN_URL, '_blank')}
                  className="block w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
            <button
              onClick={() => window.open(SLACK_PENDO_BRAIN_URL, '_blank')}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors"
              style={{ background: 'linear-gradient(135deg, #e8185a 0%, #c01348 100%)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Open in Slack
            </button>
          </div>
        </div>
      )}
    </>
  )
}
