interface ProgressBarProps {
  completed: number
  total: number
  showLabel?: boolean
}

export function ProgressBar({ completed, total, showLabel = true }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{completed} of {total} completed</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-pendo-pink rounded-full h-2 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
