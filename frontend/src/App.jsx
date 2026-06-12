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

export default function App() {
  const { phase, file, stages, narrative, result, error, analyze, reset } = useAnalysis()

  // ── Resize state ────────────────────────────────────────────────────────────
  const [topRowH,   startDragTopRow]   = useResize(260, 140, 520)  // top narrative row height
  const [anomalyW,  startDragAnomalyW] = useResize(308, 180, 560)  // anomaly panel width
  const [sessionW,  startDragSessionW] = useResize(268, 160, 420)  // session health width
  const [protoW,    startDragProtoW]   = useResize(256, 160, 420)  // protocol breakdown width

  const isActive = phase === 'uploading' || phase === 'analyzing' || phase === 'complete' || phase === 'error'
  const hasResult = !!result

  // ── Upload / landing page ───────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-10 animate-slide-up">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-blue-400/80 text-[11px] font-semibold uppercase tracking-[0.2em]">
              Network Traffic Analysis
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            PCAP <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Storyteller</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-sm mx-auto leading-relaxed">
            Upload a packet capture and get a plain-English analysis of your traffic.
          </p>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <DropZone onAnalyze={analyze} disabled={false} />
        </div>

        <div className="mt-12 flex items-center gap-5 text-slate-600 text-xs flex-wrap justify-center animate-fade-in" style={{ animationDelay: '200ms' }}>
          {['Port Survey', 'SYN Floods', 'Exfiltration', 'DNS Anomaly', 'Cleartext', 'Beaconing', 'Retransmissions', 'Half-Open Sessions', 'RST Storms', 'Zero-Window'].map(label => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              {label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // ── Analysis page ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-gray-950/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-white font-semibold text-sm tracking-tight">PCAP Storyteller</span>
        </div>

        <div className="flex items-center gap-3">
          {file && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-slate-300 text-xs font-mono">{file.name}</span>
              <span className="text-slate-500 text-xs">{fmtSize(file.size)}</span>
            </div>
          )}
          {phase === 'complete' && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white
                border border-slate-700 hover:border-slate-500 transition-colors duration-150"
            >
              New file
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — pipeline */}
        <aside className="w-52 flex-shrink-0 border-r border-slate-800 p-5 bg-gray-950 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Pipeline</p>
          <PipelineProgress stages={stages} />
          {phase === 'error' && (
            <button
              onClick={reset}
              className="mt-6 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white
                border border-slate-700 hover:border-red-500/50 transition-colors"
            >
              Try again
            </button>
          )}
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── TOP ROW: Narrative + Anomaly flags ── */}
          <div
            className="flex flex-shrink-0 px-4 pt-3 overflow-hidden"
            style={{ height: topRowH }}
          >
            {phase === 'error' ? (
              <div className="flex-1 flex items-center justify-center pb-3">
                <div className="max-w-md w-full bg-red-500/8 border border-red-500/20 rounded-xl p-6 text-center animate-scale-in">
                  <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-400 font-medium mb-2">Analysis failed</p>
                  <p className="text-slate-400 text-sm">{error}</p>
                </div>
              </div>
            ) : (
              <NarrativePanel
                narrative={narrative}
                isStreaming={phase === 'analyzing'}
                result={result}
              />
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

          {/* ── HORIZONTAL RESIZE: top row ↕ intelligence row ── */}
          {hasResult && (
            <ResizeHandle onMouseDown={(e) => startDragTopRow(e, 'y', false)} axis="y" />
          )}

          {/* ── INTELLIGENCE ROW: IP / Session / Protocol ── */}
          {result?.summary && (
            <div className="flex flex-1 px-4 pb-2 min-h-0 overflow-hidden">
              <IPInventory summary={result.summary} />
              <ResizeHandle onMouseDown={(e) => startDragSessionW(e, 'x', true)} axis="x" />
              <SessionHealth
                summary={result.summary}
                style={{ width: sessionW, minWidth: 160 }}
              />
              <ResizeHandle onMouseDown={(e) => startDragProtoW(e, 'x', true)} axis="x" />
              <ProtocolBreakdown
                summary={result.summary}
                style={{ width: protoW, minWidth: 160 }}
              />
            </div>
          )}

          {/* ── TIMELINE ── */}
          {hasResult && (
            <Timeline
              flows={result.flows}
              anomalies={result.anomalies}
              summary={result.summary}
            />
          )}
        </main>
      </div>
    </div>
  )
}
