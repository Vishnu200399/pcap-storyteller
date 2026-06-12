function fmtBytes(b) {
  if (!b) return '0 B'
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b > 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
}

function fmtTime(epoch) {
  if (!epoch) return 'unknown'
  return new Date(epoch * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function buildNarrative(summary, anomalies) {
  const paras = []

  const retrxRate   = summary.retransmissionRate ?? 0
  const retrxPct    = (retrxRate * 100).toFixed(2)
  const encPct      = ((summary.encryptedRatio ?? 0) * 100).toFixed(0)
  const ss          = summary.sessionStats
  const allProtos   = summary.allProtocols ?? {}
  const inv         = summary.ipInventory ?? []
  const internal    = inv.filter(e => e.isInternal)
  const external    = inv.filter(e => !e.isInternal)
  const topFlows    = summary.topFlowsByBytes ?? []

  // ── Para 1: Executive overview ────────────────────────────────────────────
  const protosByCount = Object.entries(summary.protocols ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ')

  const healthLabel = retrxRate > 0.15
    ? 'elevated — consistent with path congestion or packet loss'
    : retrxRate > 0.05
      ? 'moderate — approaching the 5% advisory threshold'
      : 'within healthy baseline (<5%)'

  paras.push(
    `Capture window: ${fmtTime(summary.captureStart)} to ${fmtTime(summary.captureEnd)} ` +
    `(${summary.captureDuration.toFixed(1)} s). ` +
    `${summary.totalPackets.toLocaleString()} packets across ${summary.flowCount.toLocaleString()} flows — ` +
    `total volume ${fmtBytes(summary.totalBytes)}, of which ${encPct}% traverses encrypted channels. ` +
    `Protocol distribution by flow count: ${protosByCount || 'N/A'}. ` +
    `TCP retransmission rate: ${retrxPct}% (${healthLabel}).`
  )

  // ── Para 2: Top talkers and flows ─────────────────────────────────────────
  const flowParts = []

  if (topFlows.length > 0) {
    const f0 = topFlows[0]
    const svc = f0.service ? ` (${f0.service})` : ''
    flowParts.push(
      `Highest-volume conversation: ${f0.src} → ${f0.dst}:${f0.dstPort ?? '?'}${svc} [${f0.proto}] — ${fmtBytes(f0.bytes)}.`
    )
    if (topFlows.length > 1) {
      const rest = topFlows.slice(1, 4)
        .map(f => `${f.src}→${f.dst}:${f.dstPort ?? '?'}${f.service ? ` [${f.service}]` : ''} ${fmtBytes(f.bytes)}`)
        .join('; ')
      flowParts.push(`Next: ${rest}.`)
    }
  }

  if (internal.length > 0) {
    const h = internal[0]
    flowParts.push(
      `Internal top-talker: ${h.ip} (${h.role}) — ↑${fmtBytes(h.bytesSent)} ↓${fmtBytes(h.bytesReceived)}, ${h.uniquePeers} peer(s).`
    )
  }
  if (external.length > 0) {
    const ext = external.slice(0, 4)
      .map(e => `${e.ip} (${fmtBytes(e.bytesSent + e.bytesReceived)})`).join(', ')
    flowParts.push(`External endpoints by volume: ${ext}.`)
  }

  if (flowParts.length) paras.push(flowParts.join(' '))

  // ── Para 3: TCP session health & retransmissions ──────────────────────────
  if (ss) {
    const tcpParts = []
    const total = ss.established + ss.halfOpen + ss.reset + ss.gracefulClose + ss.unknown

    tcpParts.push(
      `TCP session states (${total} flows): ` +
      [
        ss.established  > 0 && `${ss.established} established`,
        ss.gracefulClose > 0 && `${ss.gracefulClose} graceful-close (FIN exchange)`,
        ss.reset         > 0 && `${ss.reset} RST-terminated`,
        ss.halfOpen      > 0 && `${ss.halfOpen} half-open (SYN, no SYN-ACK)`,
        ss.unknown       > 0 && `${ss.unknown} indeterminate`,
      ].filter(Boolean).join(', ') + '.'
    )

    tcpParts.push(
      `Retransmissions: ${summary.retransmissionTotal.toLocaleString()} packets (${retrxPct}% of capture). ` +
      (retrxRate > 0.15
        ? `Above the 15% threshold — strong indicator of path congestion, receive-buffer exhaustion, or lossy link segments. Examine interface error counters and queue-drop stats on the highest-retransmitting endpoints.`
        : retrxRate > 0.05
          ? `Above the 5% advisory boundary — minor congestion or jitter may be present.`
          : `Within the healthy operational baseline.`
      )
    )

    if ((summary.ackLostSegmentTotal ?? 0) > 0) {
      tcpParts.push(
        `ACK-for-unseen-segment events: ${summary.ackLostSegmentTotal.toLocaleString()} — ` +
        `receiver acknowledging data the capture did not observe. This typically indicates asymmetric routing ` +
        `(capture point only sees one traffic direction) or capture-point gaps mid-stream.`
      )
    }

    if ((summary.outOfOrderTotal ?? 0) > 0) {
      tcpParts.push(
        `Out-of-order segments: ${summary.outOfOrderTotal.toLocaleString()} — ` +
        `packets arriving out of sequence; typically caused by multipath routing, ` +
        `load-balancing across unequal-latency paths, or congestion-induced reordering.`
      )
    }

    if (ss.halfOpen > 5) {
      tcpParts.push(
        `${ss.halfOpen} half-open sessions: destinations were unreachable, silently dropping SYNs ` +
        `(host-based or network firewall), or temporarily unable to respond. ` +
        `Correlate with ICMP unreachables or firewall deny logs for confirmation.`
      )
    }

    if (ss.reset > 20) {
      tcpParts.push(
        `${ss.reset} RST-terminated sessions — may reflect application-level rejection, ` +
        `stateful firewall intervention, idle-timeout teardown, or mismatched TCP keepalive parameters.`
      )
    }

    paras.push(tcpParts.join(' '))
  }

  // ── Para 4: Protocol observations ─────────────────────────────────────────
  const protoParts = []

  const byteEntries = Object.entries(summary.protocolByBytes ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  if (byteEntries.length) {
    const total = summary.totalBytes || 1
    protoParts.push(
      `By data volume: ` +
      byteEntries.map(([k, v]) => `${k} ${fmtBytes(v)} (${((v / total) * 100).toFixed(1)}%)`).join(', ') + '.'
    )
  }

  const quicCount  = allProtos['QUIC']       ?? 0
  const tls12      = allProtos['TLSv1.2']    ?? 0
  const tls13      = allProtos['TLSv1.3']    ?? 0
  const http2      = allProtos['HTTP2']      ?? 0
  const mdnsCount  = allProtos['MDNS']       ?? 0
  const ntpCount   = allProtos['NTP']        ?? 0
  const dhcpCount  = allProtos['DHCP']       ?? 0
  const dnsCount   = allProtos['DNS']        ?? 0

  if (quicCount > 0) {
    protoParts.push(
      `QUIC: ${quicCount.toLocaleString()} packets — UDP-based multiplexed transport (HTTP/3 or browser-to-CDN). ` +
      `QUIC handles congestion control and retransmission internally; ` +
      `standard TCP retransmission analysis does not apply to these flows.`
    )
  }
  if (tls12 + tls13 > 0) {
    protoParts.push(
      `TLS: ${(tls12 + tls13).toLocaleString()} packets ` +
      `(v1.2: ${tls12.toLocaleString()}, v1.3: ${tls13.toLocaleString()}) — payload opaque without session keys.`
    )
  }
  if (http2 > 0) {
    protoParts.push(`HTTP/2: ${http2.toLocaleString()} packets — multiplexed streams over a single TCP connection.`)
  }
  if (dnsCount > 0) {
    protoParts.push(`DNS: ${dnsCount.toLocaleString()} packets.`)
  }
  if (mdnsCount > 0) {
    protoParts.push(`mDNS: ${mdnsCount.toLocaleString()} packets — local-link service discovery (Bonjour / Avahi).`)
  }
  if (ntpCount > 0) {
    protoParts.push(`NTP: ${ntpCount.toLocaleString()} packets — clock synchronization.`)
  }
  if (dhcpCount > 0) {
    protoParts.push(`DHCP: ${dhcpCount.toLocaleString()} packets.`)
  }

  const knownLabels = new Set([
    'QUIC','TLSv1.2','TLSv1.3','HTTP2','DNS','MDNS','ARP','NTP','DHCP',
    'TCP','UDP','ICMP','ICMPv6','HTTP','HTTPS','TLS','SSL','FTP','SSH',
    'SMTP','SMTP/IMF','POP3','IMAP','RDP','SIP','RTP','OCSP','STUN',
    'TCP Segment','UDP Segment','SSLv2','SSLv3',
  ])
  const other = Object.entries(allProtos)
    .filter(([k]) => !knownLabels.has(k) && k.length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  if (other.length > 0) {
    protoParts.push(`Additional protocols: ${other.map(([k, v]) => `${k} (${v} pkts)`).join(', ')}.`)
  }

  protoParts.push(
    `Endpoint summary: ${inv.length} total IP addresses ` +
    `(${internal.length} RFC-1918/loopback, ${external.length} external).`
  )

  paras.push(protoParts.join(' '))

  // ── Para 5: Behavioral observations ──────────────────────────────────────
  if (anomalies.length > 0) {
    const lines = [
      `${anomalies.length} behavioral observation${anomalies.length !== 1 ? 's' : ''} flagged (severity 1–10):`
    ]
    for (const a of anomalies.slice(0, 10)) {
      lines.push(`  • [${a.severity}/10]  ${a.description}`)
    }
    if (anomalies.length > 10) {
      lines.push(`  … ${anomalies.length - 10} additional lower-severity events omitted.`)
    }
    paras.push(lines.join('\n'))
  } else {
    paras.push(
      'No behavioral events were detected above configured thresholds. ' +
      'Traffic patterns are consistent with normal operational activity for the observed endpoints and protocols.'
    )
  }

  // ── Para 6: Wireshark display filter recommendations ─────────────────────
  const recs = []

  if (retrxRate > 0.05) {
    recs.push(`Retransmission events:  tcp.analysis.retransmission || tcp.analysis.duplicate_ack`)
  }
  if ((summary.ackLostSegmentTotal ?? 0) > 0) {
    recs.push(`ACK-for-unseen-segment: tcp.analysis.ack_lost_segment  (verify capture covers both traffic directions)`)
  }
  if ((summary.outOfOrderTotal ?? 0) > 0) {
    recs.push(`Out-of-order segments:  tcp.analysis.out_of_order`)
  }
  if (ss?.halfOpen > 5) {
    recs.push(`Unanswered SYNs:        tcp.flags.syn==1 && tcp.flags.ack==0 && !tcp.analysis.retransmission`)
  }
  if (ss?.reset > 20) {
    recs.push(`RST activity:           tcp.flags.reset==1  (group by ip.src and ip.dst)`)
  }
  if (topFlows[0]) {
    const f = topFlows[0]
    const portPart = f.dstPort ? ` && tcp.port==${f.dstPort}` : ''
    recs.push(`Top-flow drill-down:    ip.addr==${f.src} && ip.addr==${f.dst}${portPart}`)
  }

  const beaconing = anomalies.find(a => a.type === 'beaconing')
  if (beaconing?.dstIp) {
    recs.push(`Regular-interval flows: ip.addr==${beaconing.dstIp}  (inspect application identity)`)
  }
  const dnsTunnel = anomalies.find(a => a.type === 'dns_tunneling')
  if (dnsTunnel?.srcIp) {
    recs.push(`Extended DNS queries:   dns && ip.src==${dnsTunnel.srcIp}  (sort by dns.qry.name length)`)
  }
  const portScan = anomalies.find(a => a.type === 'port_scan')
  if (portScan?.srcIp) {
    recs.push(`Wide port contact:      ip.src==${portScan.srcIp} && tcp.flags.syn==1`)
  }
  const cleartext = anomalies.find(a => a.type === 'cleartext_creds')
  if (cleartext) {
    const proto = cleartext.dstPort === 21 ? 'ftp' : cleartext.dstPort === 23 ? 'telnet' : `tcp.port==${cleartext.dstPort}`
    recs.push(`Cleartext session:      ${proto}  (follow TCP stream for credential review)`)
  }

  if (recs.length > 0) {
    paras.push(`Recommended Wireshark display filters:\n${recs.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`)
  }

  return paras.join('\n\n')
}

export async function* narrateCapture(summary, anomalies) {
  yield buildNarrative(summary, anomalies)
}
