const PROTO_COLOR = {
  TCP:          'bg-blue-500',
  UDP:          'bg-green-500',
  ICMP:         'bg-yellow-500',
  ICMPv6:       'bg-yellow-400',
  DNS:          'bg-purple-400',
  MDNS:         'bg-pink-400',
  HTTP:         'bg-orange-400',
  HTTP2:        'bg-orange-500',
  HTTPS:        'bg-emerald-400',
  QUIC:         'bg-violet-400',
  TLS:          'bg-emerald-500',
  'TLSv1.2':    'bg-emerald-400',
  'TLSv1.3':    'bg-emerald-300',
  SSL:          'bg-emerald-600',
  ARP:          'bg-slate-400',
  NTP:          'bg-cyan-400',
  DHCP:         'bg-yellow-300',
  SSH:          'bg-teal-400',
  FTP:          'bg-red-400',
  Telnet:       'bg-red-500',
  SMTP:         'bg-amber-400',
  'SMTP/IMF':   'bg-amber-400',
  POP3:         'bg-amber-500',
  IMAP:         'bg-amber-600',
  LDAP:         'bg-sky-400',
  LDAPS:        'bg-sky-500',
  RDP:          'bg-pink-500',
  SIP:          'bg-rose-400',
  RTP:          'bg-rose-300',
  OCSP:         'bg-slate-500',
  STUN:         'bg-indigo-400',
  SNMP:         'bg-lime-400',
  Syslog:       'bg-slate-300',
}

function ProtoBar({ name, count, pct }) {
  const color = PROTO_COLOR[name] ?? 'bg-slate-500'
  return (
    <div className="space-y-0.5 animate-fade-in">
      <div className="flex items-center justify-between text-[10px] gap-1">
        <span className="text-slate-200 font-mono font-medium truncate" title={name}>{name}</span>
        <div className="flex items-center gap-2 text-slate-500 flex-shrink-0">
          <span className="font-mono text-slate-400 tabular-nums">{count.toLocaleString()}</span>
          <span className="w-8 text-right text-[9px] text-slate-500">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
      </div>
    </div>
  )
}

export function ProtocolBreakdown({ summary, style }) {
  if (!summary) return null

  const allProtos = summary.allProtocols ?? {}
  const ipProtos  = summary.protocolByBytes ?? {}

  // Use allProtocols (packet count) as primary view — shows QUIC, TLS, HTTP2, etc.
  const total = Object.values(allProtos).reduce((s, v) => s + v, 0) || 1
  const entries = Object.entries(allProtos)
    .filter(([, v]) => v > 0)
    .map(([name, count]) => ({
      name,
      count,
      pct: parseFloat(((count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count)

  // Fall back to IP-layer proto counts if allProtocols not available
  const ipEntries = Object.entries(ipProtos)
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes)

  const encPct   = ((summary.encryptedRatio ?? 0) * 100).toFixed(1)
  const clearPct = (100 - parseFloat(encPct)).toFixed(1)

  const hasAll = entries.length > 0

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden h-full animate-slide-up"
      style={style}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Protocols</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            {encPct}% enc
          </span>
          {hasAll && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-slate-700 font-mono">
              {entries.length} types
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">

        {/* All protocols by packet count */}
        {hasAll ? (
          <div className="space-y-2">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">All protocols (packets)</p>
            <div className="space-y-2">
              {entries.map(e => (
                <ProtoBar key={e.name} name={e.name} count={e.count} pct={e.pct} />
              ))}
            </div>
          </div>
        ) : (
          // Fallback: IP-layer by bytes
          <div className="space-y-2">
            {ipEntries.map(e => {
              const totalBytes = summary.totalBytes || 1
              const pct = parseFloat(((e.bytes / totalBytes) * 100).toFixed(1))
              return (
                <ProtoBar key={e.name} name={e.name} count={e.bytes} pct={pct} />
              )
            })}
          </div>
        )}

        {/* Encrypted vs cleartext */}
        <div className="pt-1 border-t border-slate-800/60 space-y-1.5">
          <p className="text-[9px] text-slate-600 uppercase tracking-wider">Encrypted vs cleartext</p>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${encPct}%` }} />
            <div className="bg-orange-500/70 flex-1" />
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-emerald-400 font-mono">{encPct}% enc</span>
            <span className="text-orange-400 font-mono">{clearPct}% clear</span>
          </div>
        </div>
      </div>
    </div>
  )
}
