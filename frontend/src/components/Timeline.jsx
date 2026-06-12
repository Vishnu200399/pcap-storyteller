const DOT_COLOR = {
  port_scan:        'bg-purple-400',
  syn_flood:        'bg-red-400',
  exfiltration:     'bg-orange-400',
  dns_tunneling:    'bg-yellow-400',
  cleartext_creds:  'bg-blue-400',
  beaconing:        'bg-pink-400',
  retransmission:   'bg-amber-400',
  session_half_open:'bg-cyan-400',
  rst_storm:        'bg-rose-400',
  zero_window:      'bg-teal-400',
}

const TYPE_LABEL = {
  port_scan:        'Port Scan',
  syn_flood:        'SYN Flood',
  exfiltration:     'Exfiltration',
  dns_tunneling:    'DNS Tunnel',
  cleartext_creds:  'Cleartext',
  beaconing:        'Beaconing',
  retransmission:   'Retrx',
  session_half_open:'Half-Open',
  rst_storm:        'RST Storm',
  zero_window:      'Zero Win',
}

function fmtTime(epochSec, captureDuration) {
  const d = new Date(epochSec * 1000)
  return captureDuration > 3600
    ? d.toISOString().slice(11, 16)   // HH:MM
    : d.toISOString().slice(11, 19)   // HH:MM:SS
}

export function Timeline({ flows, anomalies, summary }) {
  if (!summary || !flows?.length) return null

  const { captureStart, captureEnd, captureDuration } = summary
  if (!captureDuration || captureDuration <= 0) return null

  const flowTimes = new Map(flows.map(f => [f.id, f.startTime]))

  const toPercent = (t) =>
    Math.max(0, Math.min(100, ((t - captureStart) / captureDuration) * 100))

  const markers = anomalies
    .map(a => {
      const times = a.flowIds.map(id => flowTimes.get(id)).filter(Boolean)
      if (!times.length) return null
      return { ...a, pct: toPercent(Math.min(...times)) }
    })
    .filter(Boolean)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    pct: ratio * 100,
    label: fmtTime(captureStart + captureDuration * ratio, captureDuration),
  }))

  return (
    <div className="flex-shrink-0 border-t border-slate-800 bg-gray-950 px-6 pt-3 pb-4">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Timeline</span>
        <span className="text-[10px] text-slate-700 font-mono">{captureDuration.toFixed(1)}s</span>
        {/* Legend */}
        <div className="flex items-center gap-3 ml-2">
          {[...new Set(markers.map(m => m.type))].map(type => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-slate-600">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLOR[type] ?? 'bg-slate-400'}`} />
              {TYPE_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      </div>

      {/* Track */}
      <div className="relative h-5">
        {/* Base track */}
        <div className="absolute left-0 right-0 top-[9px] h-0.5 bg-slate-800 rounded-full" />

        {/* Anomaly markers */}
        {markers.map((a, i) => (
          <div
            key={`${a.id}-${i}`}
            className="absolute group"
            style={{ left: `${a.pct}%`, top: '2px', transform: 'translateX(-50%)' }}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full border-2 border-gray-950 cursor-default
                ${DOT_COLOR[a.type] ?? 'bg-slate-400'}`}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
              hidden group-hover:block z-20 pointer-events-none">
              <div className="bg-gray-900 border border-slate-700 rounded-md px-2 py-1.5
                text-[10px] text-slate-300 whitespace-nowrap shadow-xl">
                <span className="font-semibold">{TYPE_LABEL[a.type] ?? a.type}</span>
                <span className="text-slate-500 ml-1.5">sev {a.severity}</span>
              </div>
              <div className="w-px h-1.5 bg-slate-700 mx-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Time axis labels */}
      <div className="relative h-3.5 mt-0.5">
        {ticks.map(({ pct, label }) => (
          <span
            key={pct}
            className="absolute text-[9px] text-slate-700 font-mono select-none"
            style={{ left: `${pct}%`, transform: pct === 0 ? 'none' : pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
