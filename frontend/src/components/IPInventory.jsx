const ROLE_BADGE = {
  server:         'bg-blue-500/15 text-blue-300 border-blue-500/30',
  client:         'bg-slate-500/15 text-slate-400 border-slate-600/30',
  dns_server:     'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  gateway_client: 'bg-green-500/15 text-green-300 border-green-500/30',
  mixed:          'bg-purple-500/15 text-purple-300 border-purple-500/30',
}

const ROLE_LABEL = {
  server:         'server',
  client:         'client',
  dns_server:     'dns',
  gateway_client: 'gateway',
  mixed:          'mixed',
}

function fmtBytes(b) {
  if (!b) return '0'
  if (b > 1e9) return `${(b / 1e9).toFixed(1)}G`
  if (b > 1e6) return `${(b / 1e6).toFixed(1)}M`
  if (b > 1e3) return `${(b / 1e3).toFixed(0)}K`
  return `${b}B`
}

function IPRow({ entry }) {
  const badge = ROLE_BADGE[entry.role] ?? 'bg-slate-500/15 text-slate-400 border-slate-600/30'
  const label = ROLE_LABEL[entry.role] ?? entry.role

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/40 transition-colors group">
      <span className="font-mono text-[11px] text-slate-200 w-32 flex-shrink-0 truncate">{entry.ip}</span>
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${badge}`}>
        {label}
      </span>
      <span className="text-[10px] text-slate-500 font-mono ml-auto flex-shrink-0">
        <span className="text-slate-600">↑</span>{fmtBytes(entry.bytesSent)}
      </span>
      <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
        <span className="text-slate-600">↓</span>{fmtBytes(entry.bytesReceived)}
      </span>
      <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 w-12 text-right">
        {entry.uniquePeers}p
      </span>
    </div>
  )
}

export function IPInventory({ summary }) {
  if (!summary?.ipInventory?.length) return null

  const internal = summary.ipInventory.filter(e => e.isInternal)
  const external = summary.ipInventory.filter(e => !e.isInternal).slice(0, 8)

  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden h-full animate-slide-up">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">IP Inventory</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            {internal.length} int
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 font-mono">
            {external.length} ext
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-1">
        {internal.length > 0 && (
          <>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider px-2 pt-1 pb-0.5">Internal</p>
            {internal.map(e => <IPRow key={e.ip} entry={e} />)}
          </>
        )}
        {external.length > 0 && (
          <>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider px-2 pt-2 pb-0.5">External (top by traffic)</p>
            {external.map(e => <IPRow key={e.ip} entry={e} />)}
          </>
        )}
      </div>
    </div>
  )
}
