import { useState, useCallback, useRef } from 'react'

async function streamSSE(url, handlers, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Analysis failed (${res.status})`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const blocks = buf.split('\n\n')
      buf = blocks.pop() ?? ''
      for (const block of blocks) {
        if (!block.trim()) continue
        const lines = block.split('\n')
        const ev = lines.find(l => l.startsWith('event:'))?.slice(7).trim() ?? 'message'
        const dl = lines.find(l => l.startsWith('data:'))
        if (!dl) continue
        try { handlers[ev]?.(JSON.parse(dl.slice(5))) } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

const STAGES = [
  { id: 'upload',  label: 'Upload File',        triggerSteps: [] },
  { id: 'parse',   label: 'Parse Packets',       triggerSteps: ['parsing', 'parsed'] },
  { id: 'extract', label: 'Extract Flows',       triggerSteps: ['flows', 'extracted'] },
  { id: 'score',   label: 'Score Anomalies',     triggerSteps: ['scoring', 'scored'] },
  { id: 'narrate', label: 'Generate Narrative',  triggerSteps: ['narrating'] },
]

const DONE_STEPS = new Set(['parsed', 'extracted', 'scored'])

function initialStages() {
  return STAGES.map(s => ({ id: s.id, label: s.label, status: 'pending', detail: null }))
}

function stageIdForStep(step) {
  return STAGES.find(s => s.triggerSteps.includes(step))?.id ?? null
}

export function useAnalysis() {
  const [phase, setPhase] = useState('idle')
  const [file, setFile] = useState(null)
  const [stages, setStages] = useState(initialStages)
  const [narrative, setNarrative] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const analyze = useCallback(async (selectedFile) => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const patchStage = (id, patch) =>
      setStages(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))

    setFile(selectedFile)
    setPhase('uploading')
    setStages(initialStages())
    setNarrative('')
    setResult(null)
    setError(null)
    patchStage('upload', { status: 'active', detail: 'Uploading…' })

    try {
      const form = new FormData()
      form.append('pcap', selectedFile)
      const API = import.meta.env.VITE_API_URL ?? '/api'
      const upRes = await fetch(`${API}/upload`, { method: 'POST', body: form, signal: abort.signal })
      if (!upRes.ok) {
        const { error: msg } = await upRes.json()
        throw new Error(msg ?? 'Upload failed')
      }
      const { jobId, size } = await upRes.json()
      const kb = (size / 1024).toFixed(0)
      patchStage('upload', { status: 'done', detail: `${kb} KB received` })

      setPhase('analyzing')

      await streamSSE(`${API}/analyze/${jobId}`, {
        progress(data) {
          const sid = stageIdForStep(data.step)
          if (!sid) return
          patchStage(sid, {
            status: DONE_STEPS.has(data.step) ? 'done' : 'active',
            detail: data.message,
          })
        },
        token(data) {
          setNarrative(prev => prev + data.token)
        },
        complete(data) {
          setResult(data)
          patchStage('narrate', { status: 'done', detail: 'Complete' })
          setPhase('complete')
        },
        error(data) {
          throw new Error(data.message)
        },
      }, abort.signal)

    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setPhase('error')
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
    setFile(null)
    setStages(initialStages())
    setNarrative('')
    setResult(null)
    setError(null)
  }, [])

  return { phase, file, stages, narrative, result, error, analyze, reset }
}
