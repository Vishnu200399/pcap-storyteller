import { useState } from 'react'
import { useAnalysis } from './hooks/useAnalysis'
import { useResize }   from './hooks/useResize'
import { DropZone }    from './components/DropZone'
import { PipelineProgress }   from './components/PipelineProgress'
import { NarrativePanel }     from './components/NarrativePanel'
import { AnomalyFlags }       from './components/AnomalyFlags'
import { Timeline }           from './components/Timeline'
import { IPInventory }        from './components/IPInventory'
import { SessionHealth }      from './components/SessionHealth'
import { ProtocolBreakdown }  from './components/ProtocolBreakdown'
import { ResizeHandle }       from './components/ResizeHandle'

function fmtSize(b) {
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b > 1e3) return `${(b / 1e3).toFixed(0)} KB`
  return `${b} B`
}

const TABS = [
  { id: 'narrative', label: 'Analysis',  icon: 'doc'   },
  { id: 'events',    label: 'Events',    icon: 'alert' },
  { id: 'ips',       label: 'IPs',       icon: 'globe' },
  { id: 'health',    label: 'Health',    icon: 'heart' },
  { id: 'protocols', label: 'Protocols', icon: 'chart' },
]

const ICON_PATHS = {
  doc:   'd="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"',
  alert: 'd="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"',
  globe: 'd="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"',
  heart: 'd="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"',
  chart: 'd="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"',
  menu:  'd="M4 6h16M4 12h16M4 18h16"',
  close: 'd="M6 18L18 6M6 6l12 12"',
}

function Icon({ type, className = 'w-5 h-5' }) {
  const d = ICON_PATHS[type]?.slice(3, -1)
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center h-40 text-slate-600 text-sm italic">
      {message}
    </div>
  )
}

function ErrorPanel({ error, onReset }) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="max-w-md w-full bg-red-500/8 border border-red-500/20 rounded-xl p-6 text-center animate-scale-in">
        <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-red-400 font-medium mb-2">Analysis failed</p>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        {onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-red-500/50 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { phase, file, stages, narrative, result, error, analyze, reset } = useAnalysis()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab,   setActiveTab]   = useState('narrative')

  const [topRowH,   startDragTopRow]   = useResize(260, 140, 520)
  const [anomalyW,  startDragAnomalyW] = useResize(308, 180, 560)
  const [sessionW,  startDragSessionW] = useResize(268, 160, 420)
  const [protoW,    startDragProtoW]   = useResize(256, 160, 420)

  const isActive   = phase === 'uploading' || phase === 'analyzing' || phase === 'complete' || phase === 'error'
  const hasResult  = !!result
  const eventCount = result?.anomalies?.length ?? 0

  // ── Landing page ─────────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 text-center mb-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-400 text-[11px] font-semibold uppercase tracking-[0.18em]">
              Network Traffic Analysis
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            PCAP{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
              Storyteller
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed px-4">
            Upload a packet capture and get a plain-English analysis of your network traffic.
          </p>
        </div>

        <div className="relative z-10 w-full max-w-lg animate-fade-in" style={{ animationDelay: '100ms' }}>
          <DropZone onAnalyze={analyze} disabled={false} />
        </div>

        <div
          className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-2 animate-fade-in px-4"
          style={{ animationDelay: '250ms' }}
        >
          {['Port Survey','SYN Floods','Exfiltration','DNS Anomaly','Cleartext Creds','Beaconing','Retransmissions','Half-Open','RST Storms','Zero-Window'].map(label => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-600 text-[11px]"
            >
              <span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // ── Shared header ─────────────────────────────────────────────────────────────
  const header = (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-gray-950/95 backdrop-blur-sm flex-shrink-0 z-20">
      <div className="flex items-center gap-2.5">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors mr-0.5"
          aria-label="Toggle pipeline"
        >
          <Icon type={sidebarOpen ? 'close' : 'menu'} className="w-4 h-4 text-slate-400" />
        </button>
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-white font-semibold text-sm tracking-tight">PCAP Storyteller</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {file && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 max-w-[240px]">
            <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-slate-300 text-xs font-mono truncate">{file.name}</span>
            <span className="text-slate-500 text-xs flex-shrink-0">{fmtSize(file.size)}</span>
          </div>
        )}
        {phase === 'complete' && (
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors duration-150"
          >
            New file
          </button>
        )}
      </div>
    </header>
  )

  // ── Mobile slide-in sidebar ───────────────────────────────────────────────────
  const mobileSidebar = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-slate-800 z-40 md:hidden flex flex-col transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pipeline</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Icon type="close" className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <PipelineProgress stages={stages} />
          {phase === 'error' && (
            <button
              onClick={() => { reset(); setSidebarOpen(false) }}
              className="mt-6 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-red-500/50 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
        {file && (
          <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">File</p>
            <p className="text-xs text-slate-300 font-mono truncate">{file.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{fmtSize(file.size)}</p>
          </div>
        )}
      </aside>
    </>
  )

  // ── Mobile view (bottom tabs) ─────────────────────────────────────────────────
  const mobileContent = (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden md:hidden">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-3 pb-2">
        {phase === 'error' ? (
          <ErrorPanel error={error} onReset={reset} />
        ) : activeTab === 'narrative' ? (
          <>
            <div style={{ minHeight: '55vh' }} className="flex flex-col">
              <NarrativePanel narrative={narrative} isStreaming={phase === 'analyzing'} result={result} />
            </div>
            {hasResult && (
              <div className="mt-3">
                <Timeline flows={result.flows} anomalies={result.anomalies} summary={result.summary} />
              </div>
            )}
          </>
        ) : activeTab === 'events' ? (
          eventCount > 0
            ? <AnomalyFlags anomalies={result.anomalies} style={{ height: 'auto', minHeight: '55vh' }} />
            : <EmptyState message={hasResult ? 'No anomalies detected' : 'Analysis in progress…'} />
        ) : activeTab === 'ips' ? (
          result?.summary
            ? <div style={{ height: '70vh' }} className="flex flex-col"><IPInventory summary={result.summary} /></div>
            : <EmptyState message="Analysis in progress…" />
        ) : activeTab === 'health' ? (
          result?.summary
            ? <SessionHealth summary={result.summary} style={{ height: 'auto', minHeight: '55vh' }} />
            : <EmptyState message="Analysis in progress…" />
        ) : activeTab === 'protocols' ? (
          result?.summary
            ? <ProtocolBreakdown summary={result.summary} style={{ height: 'auto', minHeight: '55vh' }} />
            : <EmptyState message="Analysis in progress…" />
        ) : null}
      </div>

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 border-t border-slate-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="flex">
          {TABS.map(tab => {
            const active = activeTab === tab.id
            const showBadge = tab.id === 'events' && eventCount > 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-3 px-1 transition-colors duration-150 border-t-2 ${
                  active
                    ? 'text-blue-400 border-blue-500'
                    : 'text-slate-600 border-transparent hover:text-slate-400'
                }`}
              >
                <div className="relative">
                  <Icon type={tab.icon} className="w-5 h-5" />
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-gray-950" />
                  )}
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider leading-none">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )

  // ── Desktop view (resizable panels) ──────────────────────────────────────────
  const desktopContent = (
    <div className="hidden md:flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-slate-800 p-5 bg-gray-950 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Pipeline</p>
        <PipelineProgress stages={stages} />
        {phase === 'error' && (
          <button
            onClick={reset}
            className="mt-6 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-red-500/50 transition-colors"
          >
            Try again
          </button>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top row: Narrative + Anomaly flags */}
        <div
          className="flex flex-shrink-0 px-4 pt-3 overflow-hidden"
          style={{ height: topRowH }}
        >
          {phase === 'error' ? (
            <ErrorPanel error={error} />
          ) : (
            <NarrativePanel narrative={narrative} isStreaming={phase === 'analyzing'} result={result} />
          )}
          {result?.anomalies?.length > 0 && (
            <>
              <ResizeHandle onMouseDown={(e) => startDragAnomalyW(e, 'x', true)} axis="x" />
              <AnomalyFlags
                anomalies={result.anomalies}
                style={{ width: anomalyW, minWidth: 180, height: '100%', paddingBottom: 12 }}
              />
            </>
          )}
        </div>

        {hasResult && (
          <ResizeHandle onMouseDown={(e) => startDragTopRow(e, 'y', false)} axis="y" />
        )}

        {/* Intelligence row — overflow-x-auto stops horizontal page blowout */}
        {result?.summary && (
          <div className="flex-1 px-4 pb-2 min-h-0 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full min-h-0" style={{ minWidth: 540 }}>
              <IPInventory summary={result.summary} />
              <ResizeHandle onMouseDown={(e) => startDragSessionW(e, 'x', true)} axis="x" />
              <SessionHealth
                summary={result.summary}
                style={{ width: sessionW, minWidth: 160, flexShrink: 0 }}
              />
              <ResizeHandle onMouseDown={(e) => startDragProtoW(e, 'x', true)} axis="x" />
              <ProtocolBreakdown
                summary={result.summary}
                style={{ width: protoW, minWidth: 160, flexShrink: 0 }}
              />
            </div>
          </div>
        )}

        {hasResult && (
          <Timeline flows={result.flows} anomalies={result.anomalies} summary={result.summary} />
        )}
      </main>
    </div>
  )

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {header}
      {mobileSidebar}
      {mobileContent}
      {desktopContent}
    </div>
  )
}
