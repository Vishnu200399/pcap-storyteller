import { isInternal } from './flows.js'

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

// ─── 1. PORT SCAN ────────────────────────────────────────────────────────────
// One source hitting many distinct destination ports

function detectPortScans(flows) {
  const srcMap = new Map()

  for (const flow of flows) {
    if (!flow.dstPort) continue
    if (!srcMap.has(flow.srcIp)) {
      srcMap.set(flow.srcIp, { ports: new Set(), dstIps: new Set(), flowIds: [], synOnly: 0 })
    }
    const e = srcMap.get(flow.srcIp)
    e.ports.add(flow.dstPort)
    e.dstIps.add(flow.dstIp)
    e.flowIds.push(flow.id)
    if (flow.flags.syn > 0 && flow.flags.ack === 0) e.synOnly++
  }

  const anomalies = []
  for (const [srcIp, e] of srcMap) {
    if (e.ports.size < 15) continue

    const isStealth = e.synOnly / e.flowIds.length > 0.6
    let severity = e.ports.size > 100 ? 9 : e.ports.size > 50 ? 7 : e.ports.size > 30 ? 6 : 4
    if (isStealth) severity = clamp(severity + 1, 1, 10)

    anomalies.push({
      type: 'port_scan',
      severity,
      srcIp,
      dstIp: e.dstIps.size === 1 ? [...e.dstIps][0] : null,
      dstPort: null,
      description: `${srcIp} contacted ${e.ports.size} distinct ports across ${e.dstIps.size} host(s)${isStealth ? ' — SYN-only, no data exchange observed' : ''}`,
      evidence: {
        uniquePorts: e.ports.size,
        uniqueTargets: e.dstIps.size,
        isStealth,
        sampledPorts: [...e.ports].slice(0, 20).sort((a, b) => a - b),
      },
      flowIds: e.flowIds,
    })
  }
  return anomalies
}

// ─── 2. SYN FLOOD ────────────────────────────────────────────────────────────
// Many unanswered SYN packets targeting the same destination

function detectSynFloods(flows) {
  const dstMap = new Map()

  for (const flow of flows) {
    if (flow.proto !== 'TCP') continue
    if (flow.flags.syn === 0 || flow.flags.ack > 0) continue  // only pure-SYN flows

    if (!dstMap.has(flow.dstIp)) {
      dstMap.set(flow.dstIp, { totalSyns: 0, srcIps: new Set(), flowIds: [] })
    }
    const e = dstMap.get(flow.dstIp)
    e.totalSyns += flow.flags.syn
    e.srcIps.add(flow.srcIp)
    e.flowIds.push(flow.id)
  }

  const anomalies = []
  for (const [dstIp, e] of dstMap) {
    if (e.totalSyns < 10) continue

    const isDistributed = e.srcIps.size > 3
    let severity = e.totalSyns > 1000 ? 9 : e.totalSyns > 100 ? 7 : e.totalSyns > 10 ? 5 : 3
    if (isDistributed) severity = clamp(severity + 1, 1, 10)

    anomalies.push({
      type: 'syn_flood',
      severity,
      srcIp: e.srcIps.size === 1 ? [...e.srcIps][0] : null,
      dstIp,
      dstPort: null,
      description: `${dstIp}: ${e.totalSyns} unanswered SYN packets from ${e.srcIps.size} source(s)${isDistributed ? ' (multiple sources)' : ''} — no SYN-ACK returned`,
      evidence: {
        totalSyns: e.totalSyns,
        uniqueSources: e.srcIps.size,
        isDistributed,
        sources: [...e.srcIps].slice(0, 10),
      },
      flowIds: e.flowIds,
    })
  }
  return anomalies
}

// ─── 3. DATA EXFILTRATION ────────────────────────────────────────────────────
// Internal host sending large amounts of data to an external IP
// with lopsided outbound/inbound ratio

const EXFIL_MIN_BYTES = 1024 * 1024       // 1 MB minimum to flag
const EXFIL_MIN_RATIO = 5                  // outbound must be 5× the inbound

function detectExfiltration(flows) {
  // Accumulate outbound bytes: internal -> external
  const outMap = new Map()
  for (const flow of flows) {
    if (!isInternal(flow.srcIp) || isInternal(flow.dstIp)) continue
    const key = `${flow.srcIp}|${flow.dstIp}`
    if (!outMap.has(key)) outMap.set(key, { srcIp: flow.srcIp, dstIp: flow.dstIp, outBytes: 0, inBytes: 0, flowIds: [] })
    outMap.get(key).outBytes += flow.byteCount
    outMap.get(key).flowIds.push(flow.id)
  }

  // Add inbound bytes for same pairs (external -> internal)
  for (const flow of flows) {
    if (!isInternal(flow.dstIp) || isInternal(flow.srcIp)) continue
    const key = `${flow.dstIp}|${flow.srcIp}`
    if (outMap.has(key)) outMap.get(key).inBytes += flow.byteCount
  }

  const anomalies = []
  for (const [, e] of outMap) {
    if (e.outBytes < EXFIL_MIN_BYTES) continue
    const ratio = e.inBytes > 0 ? e.outBytes / e.inBytes : Infinity
    if (ratio < EXFIL_MIN_RATIO) continue

    const mb = (e.outBytes / 1024 / 1024).toFixed(2)
    const severity = e.outBytes > 100 * 1024 * 1024 ? 9 : e.outBytes > 10 * 1024 * 1024 ? 7 : 5

    anomalies.push({
      type: 'exfiltration',
      severity,
      srcIp: e.srcIp,
      dstIp: e.dstIp,
      dstPort: null,
      description: `${e.srcIp} transferred ${mb} MB to external host ${e.dstIp} — ${e.inBytes > 0 ? `${Math.round(ratio)}:1` : 'no'} outbound/inbound ratio`,
      evidence: {
        outboundMB: parseFloat(mb),
        inboundBytes: e.inBytes,
        ratio: e.inBytes > 0 ? Math.round(ratio) : null,
      },
      flowIds: e.flowIds,
    })
  }
  return anomalies
}

// ─── 4. DNS TUNNELING ────────────────────────────────────────────────────────
// Long subdomain queries + high query frequency + oversized responses

const DNS_LONG_QUERY = 50     // characters
const DNS_LARGE_RESP = 512    // bytes
const DNS_MIN_INDICATORS = 2  // need at least 2 to flag

function calcEntropy(str) {
  const freq = {}
  for (const c of str) freq[c] = (freq[c] || 0) + 1
  return -Object.values(freq).reduce((s, n) => {
    const p = n / str.length
    return s + p * Math.log2(p)
  }, 0)
}

function detectDnsTunneling(flows) {
  const srcMap = new Map()

  for (const flow of flows) {
    if (!flow.hasDns) continue
    if (!srcMap.has(flow.srcIp)) {
      srcMap.set(flow.srcIp, { queries: [], respLens: [], flowIds: [] })
    }
    const e = srcMap.get(flow.srcIp)
    e.queries.push(...flow.dnsQueries)
    e.respLens.push(...flow.dnsRespLengths)
    e.flowIds.push(flow.id)
  }

  const anomalies = []
  for (const [srcIp, e] of srcMap) {
    if (e.queries.length === 0) continue

    const longQueries = e.queries.filter(q => q.length > DNS_LONG_QUERY)
    const largeResps = e.respLens.filter(l => l > DNS_LARGE_RESP)
    const avgLen = e.queries.reduce((s, q) => s + q.length, 0) / e.queries.length
    const highEntropyQueries = e.queries.filter(q => calcEntropy(q) > 4.0)
    const highFreq = e.queries.length > 20

    let indicators = 0
    if (longQueries.length > 0) indicators++
    if (largeResps.length > 0) indicators++
    if (avgLen > 30) indicators++
    if (highEntropyQueries.length > 0) indicators++
    if (highFreq) indicators++

    if (indicators < DNS_MIN_INDICATORS) continue

    const severity = indicators >= 4 ? 9 : indicators === 3 ? 7 : 5

    anomalies.push({
      type: 'dns_tunneling',
      severity,
      srcIp,
      dstIp: null,
      dstPort: 53,
      description: `${srcIp}: ${e.queries.length} DNS queries, avg ${Math.round(avgLen)}-char labels, ${longQueries.length} extended-name queries, ${largeResps.length} oversized responses (${highEntropyQueries.length} high-entropy names)`,
      evidence: {
        totalQueries: e.queries.length,
        longQueryCount: longQueries.length,
        highEntropyCount: highEntropyQueries.length,
        largeResponseCount: largeResps.length,
        avgQueryLength: Math.round(avgLen),
        indicatorCount: indicators,
        sampleLongQueries: longQueries.slice(0, 3),
      },
      flowIds: e.flowIds,
    })
  }
  return anomalies
}

// ─── 5. CLEARTEXT CREDENTIALS ────────────────────────────────────────────────
// Traffic over protocols that carry credentials unencrypted

const CLEARTEXT_PORTS = {
  21:  { name: 'FTP',   severity: 7, risk: 'credentials sent in plaintext' },
  23:  { name: 'Telnet', severity: 9, risk: 'full session including credentials in plaintext' },
  25:  { name: 'SMTP',  severity: 5, risk: 'email and possible credentials in plaintext' },
  80:  { name: 'HTTP',  severity: 4, risk: 'web credentials may be transmitted in plaintext' },
  110: { name: 'POP3',  severity: 6, risk: 'email credentials in plaintext' },
  143: { name: 'IMAP',  severity: 6, risk: 'email credentials in plaintext' },
}

function detectCleartextCreds(flows) {
  const seen = new Map()
  const anomalies = []

  for (const flow of flows) {
    if (flow.proto !== 'TCP') continue
    const portInfo = CLEARTEXT_PORTS[flow.dstPort]
    if (!portInfo) continue

    const key = `${flow.srcIp}|${flow.dstIp}|${flow.dstPort}`
    if (seen.has(key)) {
      const existing = seen.get(key)
      existing.flowIds.push(flow.id)
      existing.evidence.totalBytes += flow.byteCount
      continue
    }

    const anomaly = {
      type: 'cleartext_creds',
      severity: portInfo.severity,
      srcIp: flow.srcIp,
      dstIp: flow.dstIp,
      dstPort: flow.dstPort,
      description: `${portInfo.name} session from ${flow.srcIp} to ${flow.dstIp}:${flow.dstPort} — ${portInfo.risk}`,
      evidence: { protocol: portInfo.name, port: flow.dstPort, totalBytes: flow.byteCount },
      flowIds: [flow.id],
    }
    seen.set(key, anomaly)
    anomalies.push(anomaly)
  }
  return anomalies
}

// ─── 6. BEACONING ────────────────────────────────────────────────────────────
// Periodic outbound connections to the same external host (C2 pattern)

const BEACON_MIN_CONNECTIONS = 5
const BEACON_MAX_CV = 0.3          // coefficient of variation — lower = more regular
const BEACON_MAX_INTERVAL_SEC = 3600

function detectBeaconing(flows) {
  const pairMap = new Map()

  for (const flow of flows) {
    if (isInternal(flow.dstIp)) continue
    if (!flow.startTime) continue

    const key = `${flow.srcIp}|${flow.dstIp}|${flow.dstPort ?? 0}`
    if (!pairMap.has(key)) {
      pairMap.set(key, { srcIp: flow.srcIp, dstIp: flow.dstIp, dstPort: flow.dstPort, times: [], flowIds: [] })
    }
    pairMap.get(key).times.push(flow.startTime)
    pairMap.get(key).flowIds.push(flow.id)
  }

  const anomalies = []
  for (const [, e] of pairMap) {
    if (e.times.length < BEACON_MIN_CONNECTIONS) continue

    const sorted = [...e.times].sort((a, b) => a - b)
    const intervals = []
    for (let i = 1; i < sorted.length; i++) intervals.push(sorted[i] - sorted[i - 1])

    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length
    if (mean > BEACON_MAX_INTERVAL_SEC) continue

    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : Infinity

    if (cv > BEACON_MAX_CV) continue

    const severity = cv < 0.1 ? 8 : cv < 0.2 ? 6 : 4

    anomalies.push({
      type: 'beaconing',
      severity,
      srcIp: e.srcIp,
      dstIp: e.dstIp,
      dstPort: e.dstPort,
      description: `${e.srcIp} → ${e.dstIp}:${e.dstPort ?? '?'}: ${e.times.length} connections at ~${Math.round(mean)}s avg interval (±${Math.round(stdDev)}s, CV ${cv.toFixed(3)}) — machine-like periodicity`,
      evidence: {
        connectionCount: e.times.length,
        avgIntervalSec: Math.round(mean),
        stdDevSec: Math.round(stdDev),
        coefficientOfVariation: parseFloat(cv.toFixed(3)),
      },
      flowIds: e.flowIds,
    })
  }
  return anomalies
}

// ─── 7. RETRANSMISSIONS ───────────────────────────────────────────────────────
// Flows with a high ratio of retransmitted packets (congestion, loss, or RST)

const RETRX_MIN_PACKETS = 10
const RETRX_RATE_WARN = 0.15   // 15% retransmission rate
const RETRX_RATE_HIGH = 0.30   // 30%

function detectRetransmissions(flows) {
  const anomalies = []

  for (const flow of flows) {
    if (flow.proto !== 'TCP') continue
    if (flow.packetCount < RETRX_MIN_PACKETS) continue
    if (flow.retransmissions === 0) continue
    if (flow.retransmissionRate < RETRX_RATE_WARN) continue

    const severity = flow.retransmissionRate >= RETRX_RATE_HIGH ? 6
      : flow.retransmissionRate >= 0.20 ? 4
      : 2

    const pct = (flow.retransmissionRate * 100).toFixed(1)
    const service = flow.serviceName ? ` (${flow.serviceName})` : ''

    anomalies.push({
      type: 'retransmission',
      severity,
      srcIp: flow.srcIp,
      dstIp: flow.dstIp,
      dstPort: flow.dstPort,
      description: `${flow.srcIp} → ${flow.dstIp}:${flow.dstPort}${service} — ${pct}% retransmission rate (${flow.retransmissions}/${flow.packetCount} packets)`,
      evidence: {
        retransmissions: flow.retransmissions,
        packetCount: flow.packetCount,
        retransmissionRate: flow.retransmissionRate,
        dupAcks: flow.dupAcks,
        zeroWindows: flow.zeroWindows,
        duration: flow.duration,
        serviceName: flow.serviceName,
      },
      flowIds: [flow.id],
    })
  }

  return anomalies.sort((a, b) => b.evidence.retransmissionRate - a.evidence.retransmissionRate).slice(0, 10)
}

// ─── 8. SESSION ISSUES ────────────────────────────────────────────────────────
// Half-open connections (SYN without SYN-ACK), RST storms, zero-window stalls

function detectSessionIssues(flows) {
  const anomalies = []

  // Half-open sessions grouped by dst IP
  const halfOpenByDst = new Map()
  for (const flow of flows) {
    if (flow.tcpState !== 'half_open') continue
    if (!halfOpenByDst.has(flow.dstIp)) {
      halfOpenByDst.set(flow.dstIp, { count: 0, srcIps: new Set(), flowIds: [], dstPort: flow.dstPort })
    }
    const e = halfOpenByDst.get(flow.dstIp)
    e.count++
    e.srcIps.add(flow.srcIp)
    e.flowIds.push(flow.id)
  }

  for (const [dstIp, e] of halfOpenByDst) {
    if (e.count < 3) continue
    const severity = e.count > 20 ? 7 : e.count > 10 ? 5 : 3
    anomalies.push({
      type: 'session_half_open',
      severity,
      srcIp: e.srcIps.size === 1 ? [...e.srcIps][0] : null,
      dstIp,
      dstPort: e.dstPort,
      description: `${e.count} half-open TCP sessions to ${dstIp} from ${e.srcIps.size} source(s) — SYN sent, no SYN-ACK received`,
      evidence: {
        halfOpenCount: e.count,
        uniqueSources: e.srcIps.size,
        sources: [...e.srcIps].slice(0, 5),
      },
      flowIds: e.flowIds,
    })
  }

  // RST storms grouped by src IP
  const rstBySrc = new Map()
  for (const flow of flows) {
    if (flow.proto !== 'TCP' || flow.flags.reset === 0) continue
    if (!rstBySrc.has(flow.srcIp)) {
      rstBySrc.set(flow.srcIp, { totalRst: 0, dstIps: new Set(), flowIds: [] })
    }
    const e = rstBySrc.get(flow.srcIp)
    e.totalRst += flow.flags.reset
    e.dstIps.add(flow.dstIp)
    e.flowIds.push(flow.id)
  }

  for (const [srcIp, e] of rstBySrc) {
    if (e.totalRst < 20) continue
    const severity = e.totalRst > 200 ? 6 : e.totalRst > 50 ? 4 : 2
    anomalies.push({
      type: 'rst_storm',
      severity,
      srcIp,
      dstIp: e.dstIps.size === 1 ? [...e.dstIps][0] : null,
      dstPort: null,
      description: `${srcIp} sent ${e.totalRst} RST packets to ${e.dstIps.size} destination(s) — high-volume TCP connection reset activity`,
      evidence: {
        rstCount: e.totalRst,
        uniqueTargets: e.dstIps.size,
      },
      flowIds: e.flowIds,
    })
  }

  // Zero-window stalls
  for (const flow of flows) {
    if (flow.zeroWindows < 5) continue
    const severity = flow.zeroWindows > 50 ? 5 : flow.zeroWindows > 20 ? 3 : 2
    const service = flow.serviceName ? ` (${flow.serviceName})` : ''
    anomalies.push({
      type: 'zero_window',
      severity,
      srcIp: flow.srcIp,
      dstIp: flow.dstIp,
      dstPort: flow.dstPort,
      description: `${flow.srcIp} → ${flow.dstIp}:${flow.dstPort}${service} — ${flow.zeroWindows} zero-window advertisements, indicating receiver buffer exhaustion`,
      evidence: {
        zeroWindows: flow.zeroWindows,
        packetCount: flow.packetCount,
        duration: flow.duration,
        serviceName: flow.serviceName,
      },
      flowIds: [flow.id],
    })
  }

  return anomalies
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function scoreAnomalies(flows) {
  const all = [
    ...detectPortScans(flows),
    ...detectSynFloods(flows),
    ...detectExfiltration(flows),
    ...detectDnsTunneling(flows),
    ...detectCleartextCreds(flows),
    ...detectBeaconing(flows),
    ...detectRetransmissions(flows),
    ...detectSessionIssues(flows),
  ]

  return all
    .sort((a, b) => b.severity - a.severity)
    .map((a, i) => ({ ...a, id: `anomaly-${i}` }))
}
