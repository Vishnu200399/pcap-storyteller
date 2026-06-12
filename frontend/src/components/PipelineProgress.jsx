function StatusIcon({ status }) {
  if (status === 'active') return (
    <svg className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
  if (status === 'done') return (
    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
  if (status === 'error') return (
    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
  // pending
  return <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
    <span className="w-2 h-2 rounded-full bg-slate-700" />
  </span>
}

const LABEL_COLOR = {
  pending: 'text-slate-600',
  active:  'text-blue-300',
  done:    'text-slate-300',
  error:   'text-red-400',
}

const LINE_COLOR = {
  pending: 'bg-slate-800',
  active:  'bg-blue-500/30',
  done:    'bg-green-500/25',
  error:   'bg-red-500/30',
}

export function PipelineProgress({ stages }) {
  return (
    <ol className="space-y-0.5">
      {stages.map((stage, i) => (
        <li key={stage.id} className="flex items-start gap-3">
          {/* connector column */}
          <div className="flex flex-col items-center pt-0.5">
            <StatusIcon status={stage.status} />
            {i < stages.length - 1 && (
              <div className={`w-px h-7 mt-1 rounded-full transition-colors duration-500 ${LINE_COLOR[stage.status] ?? LINE_COLOR.pending}`} />
            )}
          </div>

          {/* text */}
          <div className="pb-2 min-w-0">
            <p className={`text-sm font-medium leading-4 transition-colors duration-300 ${LABEL_COLOR[stage.status] ?? LABEL_COLOR.pending}`}>
              {stage.label}
            </p>
            {stage.detail && (
              <p className="text-xs text-slate-500 mt-0.5 font-mono leading-snug truncate">
                {stage.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
