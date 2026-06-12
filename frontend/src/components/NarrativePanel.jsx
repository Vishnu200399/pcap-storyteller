import { useEffect, useRef } from 'react'

function fmtBytes(b) {
  if (!b) return '0 B'
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b > 1e3) return `${(b / 1e3).toFixed(0)} KB`
  return `${b} B`
}

function StatBadge({ label, value, highlight }) {
  return (
    <div className={[
      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-colors',
      highlight
        ? 'bg-red-500/10 border-red-500/25 text-red-400'
        : 'bg-slate-800/80 border-slate-700/60 text-slate-400',
    ].join(' ')}>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export function NarrativePanel({ narrative, isStreaming, result }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [narrative, isStreaming])

  const anomalyCount = result?.anomalies?.length ?? null
  const summary = result?.summary

  return (
    <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col min-h-0 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 flex-shrink-0 bg-slate-900">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isStreaming ? 'bg-blue-400 animate-pulse' : narrative ? 'bg-green-500' : 'bg-slate-600'
          }`} />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {isStreaming ? 'Building Narrative…' : 'Analysis Narrative'}
          </span>
        </div>
        {anomalyCount !== null && (
          <span className={[
            'text-xs px-2 py-0.5 rounded font-mono border',
            anomalyCount > 0
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-green-500/10 text-green-400 border-green-500/20',
          ].join(' ')}>
            {anomalyCount} {anomalyCount === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {/* Stats bar */}
      {summary && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/60 flex-wrap flex-shrink-0 bg-slate-900/50">
          <StatBadge label="pkts"     value={summary.totalPackets.toLocaleString()} />
          <StatBadge label="flows"    value={summary.flowCount.toLocaleString()} />
          <StatBadge label="vol"      value={fmtBytes(summary.totalBytes)} />
          <StatBadge label="dur"      value={`${summary.captureDuration.toFixed(1)}s`} />
          {summary.retransmissionRate > 0 && (
            <StatBadge
              label="retrx"
              value={`${(summary.retransmissionRate * 100).toFixed(2)}%`}
              highlight={summary.retransmissionRate > 0.05}
            />
          )}
          {(summary.ackLostSegmentTotal ?? 0) > 0 && (
            <StatBadge label="ack-unseen" value={summary.ackLostSegmentTotal} highlight />
          )}
          {(summary.outOfOrderTotal ?? 0) > 0 && (
            <StatBadge label="ooo" value={summary.outOfOrderTotal} />
          )}
          {summary.encryptedRatio != null && (
            <StatBadge label="enc" value={`${(summary.encryptedRatio * 100).toFixed(0)}%`} />
          )}
          {anomalyCount > 0 && (
            <StatBadge label="events" value={anomalyCount} highlight />
          )}
        </div>
      )}

      {/* Narrative text */}
      <div ref={scrollRef} className="flex-1 px-5 py-4 overflow-y-auto min-h-0">
        {!narrative ? (
          <div className="flex items-center gap-3 text-slate-600 h-full">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">Waiting for analysis…</span>
          </div>
        ) : (
          <p className="text-slate-200 text-[14px] leading-[1.85] whitespace-pre-wrap font-sans">
            {narrative}
            {isStreaming && (
              <span className="cursor-blink inline-block w-[2px] h-[1em] bg-blue-400 ml-0.5 align-text-bottom" />
            )}
          </p>
        )}
      </div>
    </div>
  )
}
