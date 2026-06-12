function StatPill({ label, value, color }) {
  const colors = {
    green:  'bg-green-500/10  text-green-400  border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red:    'bg-red-500/10    text-red-400    border-red-500/20',
    slate:  'bg-slate-700/50  text-slate-400  border-slate-700',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    cyan:   'bg-cyan-500/10   text-cyan-400   border-cyan-500/20',
  }
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${colors[color] ?? colors.slate}`}>
      <span className="font-mono text-sm font-bold">{value}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">{label}</span>
    </div>
  )
}

function StateBar({ stats }) {
  const total = (stats.established + stats.halfOpen + stats.reset + stats.gracefulClose + stats.unknown) || 1
  const segments = [
    { key: 'established',   color: 'bg-green-500',  label: 'Estab',    count: stats.established },
    { key: 'gracefulClose', color: 'bg-blue-400',   label: 'Closed',   count: stats.gracefulClose },
    { key: 'reset',         color: 'bg-red-500',    label: 'Reset',    count: stats.reset },
    { key: 'halfOpen',      color: 'bg-yellow-500', label: 'Half-open',count: stats.halfOpen },
    { key: 'unknown',       color: 'bg-slate-600',  label: 'Unknown',  count: stats.unknown },
  ].filter(s => s.count > 0)

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-500`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map(s => (
          <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.color}`} />
            {s.label}
            <span className="font-mono text-slate-400">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function SessionHealth({ summary, style }) {
  if (!summary?.sessionStats) return null

  const { sessionStats, retransmissionTotal, retransmissionRate, ackLostSegmentTotal, outOfOrderTotal } = summary
  const retrxPct    = ((retransmissionRate ?? 0) * 100).toFixed(2)
  const retrxColor  = retransmissionRate > 0.15 ? 'red' : retransmissionRate > 0.05 ? 'yellow' : 'green'
  const halfOpenCnt = sessionStats.halfOpen ?? 0
  const resetCnt    = sessionStats.reset ?? 0
  const ackLost     = ackLostSegmentTotal ?? 0
  const outOfOrder  = outOfOrderTotal ?? 0

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden h-full animate-slide-up"
      style={style}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Session Health</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">

        {/* Key stats */}
        <div className="flex gap-2 flex-wrap">
          <StatPill label="Retrx rate"  value={`${retrxPct}%`}           color={retrxColor} />
          <StatPill label="Retrx pkts"  value={retransmissionTotal ?? 0} color={retrxColor} />
          {halfOpenCnt > 0 && <StatPill label="Half-open"   value={halfOpenCnt}              color="yellow" />}
          {resetCnt    > 0 && <StatPill label="RST flows"   value={resetCnt}                 color={resetCnt > 20 ? 'orange' : 'slate'} />}
          {ackLost     > 0 && <StatPill label="ACK unseen"  value={ackLost}                  color="cyan" />}
          {outOfOrder  > 0 && <StatPill label="Out-of-order" value={outOfOrder}              color="yellow" />}
        </div>

        {/* Retransmission bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Retransmission rate</span>
            <span className="font-mono">{retrxPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                retransmissionRate > 0.15 ? 'bg-red-500' :
                retransmissionRate > 0.05 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (retransmissionRate ?? 0) * 400)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-700">
            <span>0%</span><span>good &lt;5%</span><span>warn 15%</span><span>25%+</span>
          </div>
        </div>

        {/* ACK unseen / OoO explanation */}
        {(ackLost > 0 || outOfOrder > 0) && (
          <div className="space-y-1.5 border-t border-slate-800 pt-2">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">TCP Anomalies</p>
            {ackLost > 0 && (
              <div className="flex items-start gap-2 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-500">
                  <span className="text-slate-300 font-mono">{ackLost}</span> ACK-for-unseen-segment — asymmetric routing or partial capture
                </span>
              </div>
            )}
            {outOfOrder > 0 && (
              <div className="flex items-start gap-2 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-500">
                  <span className="text-slate-300 font-mono">{outOfOrder}</span> out-of-order segments — multipath or reordering
                </span>
              </div>
            )}
          </div>
        )}

        {/* TCP session states */}
        <div className="space-y-1 border-t border-slate-800 pt-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">TCP session states</p>
          <StateBar stats={sessionStats} />
        </div>
      </div>
    </div>
  )
}
