import { useState } from 'react'
import { StepGuide as StepGuideType } from '../types'

export function StepGuide({ guide }: { guide: StepGuideType }) {
  const [activeTab, setActiveTab] = useState(guide.tabs[0]?.id ?? '')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const tab = guide.tabs.find(t => t.id === activeTab) ?? guide.tabs[0]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {guide.tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-white text-pendo-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab && (
        <div>
          {/* Overview callout */}
          {tab.overview && (
            <div className="bg-pendo-navy bg-opacity-5 border-l-4 border-pendo-pink rounded-r-lg p-4 mb-5 text-sm text-gray-700 leading-relaxed">
              {tab.overview}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3 mb-5">
            {tab.steps.map((step, i) => (
              <div key={i} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-pendo-pink bg-opacity-10 text-pendo-pink font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-pendo-navy text-sm">{step.title}</p>
                    {step.badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        {step.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tip / Note */}
          {(tab.tip || tab.note) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed mb-2">
              <span className="font-semibold text-amber-800">{tab.tip ? 'Tip: ' : 'Note: '}</span>
              {tab.tip ?? tab.note}
            </div>
          )}
        </div>
      )}

      {/* FAQs */}
      {guide.faqs && guide.faqs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-pendo-navy mb-3">Frequently asked questions</h3>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {guide.faqs.map((faq, i) => (
              <div key={i} className="bg-white">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-pendo-navy">{faq.question}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
