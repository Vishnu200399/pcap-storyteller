import { useState } from 'react'

const TYPE_CONFIG = {
  port_scan:         { label: 'Port Survey' },
  syn_flood:         { label: 'SYN Overload' },
  exfiltration:      { label: 'High Outbound' },
  dns_tunneling:     { label: 'DNS Anomaly' },
  cleartext_creds:   { label: 'Cleartext' },
  beaconing:         { label: 'Regular Interval' },
  retransmission:    { label: 'Retrx' },
  session_half_open: { label: 'Half-Open' },
  rst_storm:         { label: 'RST Storm' },
  zero_window:       { label: 'Zero Win' },
}

const TYPE_BADGE = {
  port_scan:         'bg-purple-500/15 text-purple-300 border-purple-500/30',
  syn_flood:         'bg-red-500/15    text-red-300    border-red-500/30',
  exfiltration:      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  dns_tunneling:     'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  cleartext_creds:   'bg-blue-500/15   text-blue-300   border-blue-500/30',
  beaconing:         'bg-pink-500/15   text-pink-300   border-pink-500/30',
  retransmission:    'bg-amber-500/15  text-amber-300  border-amber-500/30',
  session_half_open: 'bg-cyan-500/15   text-cyan-300   border-cyan-500/30',
  rst_storm:         'bg-rose-500/15   text-rose-300   border-rose-500/30',
  zero_window:       'bg-teal-500/15   text-teal-300   border-teal-500/30',
}

const CARD_BORDER = (s) =>
  s >= 8 ? 'border-red-500/30' : s >= 5 ? 'border-orange-500/20' : 'border-slate-700/60'

const CARD_GLOW = (s) =>
  s >= 8 ? 'shadow-[0_0_14px_rgba(239,68,68,0.12)]' : ''

const SEV_COLOR = (s) =>
  s >= 8 ? 'text-red-400' : s >= 5 ? 'text-orange-400' : 'text-yellow-400'

function EvidenceRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-3 text-xs">
      <span className="text-slate-600 flex-shrink-0">{label}</span>
      <span className="text-slate-300 font-mono text-right break-all">{String(value)}</span>
    </div>
  )
}

function AnomalyCard({ anomaly, delay }) {
  const [open, setOpen] = useState(false)
  const cfg   = TYPE_CONFIG[anomaly.type] ?? { label: anomaly.type }
  const badge = TYPE_BADGE[anomaly.type]  ?? 'bg-slate-500/15 text-slate-300 border-slate-500/30'

  return (
    <div
      className={`rounded-lg border bg-slate-900/60 overflow-hidden transition-shadow duration-300 animate-slide-up ${CARD_BORDER(anomaly.severity)} ${CARD_GLOW(anomaly.severity)}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className={`text-sm font-bold font-mono w-4 flex-shrink-0 ${SEV_COLOR(anomaly.severity)}`}>
          {anomaly.severity}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${badge}`}>
          {cfg.label}
        </span>
        <span className="text-slate-400 text-xs flex-1 truncate min-w-0">{anomaly.description}</span>
        <svg
          className={`w-3 h-3 text-slate-600 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Animated expand */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3 pt-2 border-t border-slate-800 space-y-1.5">
          {anomaly.srcIp   && <EvidenceRow label="src"  value={anomaly.srcIp} />}
          {anomaly.dstIp   && <EvidenceRow label="dst"  value={anomaly.dstIp} />}
          {anomaly.dstPort != null && <EvidenceRow label="port" value={anomaly.dstPort} />}
          {Object.entries(anomaly.evidence).map(([k, v]) => {
            if (v === null || v === undefined) return null
            if (Array.isArray(v)) {
              if (!v.length) return null
              const display = v.slice(0, 6).join(', ') + (v.length > 6 ? '…' : '')
              return <EvidenceRow key={k} label={k} value={display} />
            }
            if (typeof v === 'boolean') return <EvidenceRow key={k} label={k} value={v ? 'yes' : 'no'} />
            return <EvidenceRow key={k} label={k} value={v} />
          })}
        </div>
      </div>
    </div>
  )
}

export function AnomalyFlags({ anomalies, style }) {
  if (!anomalies?.length) return null

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden animate-fade-in"
      style={style}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 flex-shrink-0 bg-slate-900">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Events</span>
        <span className="text-xs px-2 py-0.5 rounded font-mono bg-red-500/10 text-red-400 border border-red-500/20">
          {anomalies.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {anomalies.map((a, i) => (
          <AnomalyCard key={a.id} anomaly={a} delay={i * 40} />
        ))}
      </div>
    </div>
  )
}
