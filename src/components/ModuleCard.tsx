import { Link } from 'react-router-dom'
import { ModuleWithProgress } from '../types'

interface ModuleCardProps {
  module: ModuleWithProgress
  index: number
}

const statusConfig = {
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Complete', className: 'bg-green-100 text-green-700' },
}

const categoryColors: Record<string, string> = {
  delivery: 'bg-blue-100 text-blue-700',
  product: 'bg-purple-100 text-purple-700',
  services: 'bg-orange-100 text-orange-700',
}

export function ModuleCard({ module, index }: ModuleCardProps) {
  const status = statusConfig[module.status]
  const catColor = categoryColors[module.category] ?? 'bg-gray-100 text-gray-600'

  if (module.locked) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 opacity-60 cursor-not-allowed">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400 font-medium">Module {index + 1}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{module.category}</span>
            </div>
            <h3 className="font-semibold text-gray-400 text-base">{module.title}</h3>
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{module.description}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-400 flex-shrink-0">
            Locked
          </span>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={`/module/${module.id}`}
      className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-pendo-pink transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm
          ${module.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-pendo-pink bg-opacity-10 text-pendo-pink'}`}>
          {module.status === 'completed' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span>{index + 1}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-medium">Module {index + 1}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{module.category}</span>
          </div>
          <h3 className="font-semibold text-pendo-navy text-base group-hover:text-pendo-pink transition-colors">{module.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{module.description}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${status.className}`}>
          {status.label}
        </span>
      </div>
    </Link>
  )
}
