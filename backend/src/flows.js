import { v4 as uuidv4 } from 'uuid'

const PROTO_NAME = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 58: 'ICMPv6' }

const WELL_KNOWN_PORTS = {
  20: 'FTP-data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
  53: 'DNS', 67: 'DHCP', 68: 'DHCP', 80: 'HTTP', 110: 'POP3',
  123: 'NTP', 143: 'IMAP', 161: 'SNMP', 443: 'HTTPS', 465: 'SMTPS',
  514: 'Syslog', 587: 'SMTP-sub', 636: 'LDAPS', 993: 'IMAPS',
  995: 'POP3S', 1194: 'OpenVPN', 1433: 'MSSQL', 3306: 'MySQL',
  3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC', 6379: 'Redis',
  8080: 'HTTP-alt', 8443: 'HTTPS-alt', 8888: 'HTTP-alt',
}

const ENCRYPTED_PORTS = new Set([443, 465, 636, 993, 995, 8443, 1194, 4433])

export function isInternal(ip) {
  if (!ip) return false
  const p = ip.split('.').map(Number)
  if (p.length !== 4) return false
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    p[0] === 224
  )
}

function flowKey(p) {
  const srcPort = p['tcp.srcport'] || p['udp.srcport'] || '0'
  const dstPort = p['tcp.dstport'] || p['udp.dstport'] || '0'
  return `${p['ip.src']}:${srcPort}->${p['ip.dst']}:${dstPort}|${p['ip.proto']}`
}

function inferTcpState(flags) {
  if (flags.reset > 0) return 'reset'
  if (flags.syn > 0 && flags.ack > 0 && flags.fin > 0) return 'established'
  if (flags.syn > 0 && flags.ack > 0) return 'established'
  if (flags.fin > 0 && flags.reset === 0) return 'graceful_close'
  if (flags.syn > 0 && flags.ack === 0) return 'half_open'
  if (flags.ack > 0) return 'established'
  return 'unknown'
}

export function extractFlows(packets) {
  const flowMap = new Map()

  for (const p of packets) {
    if (!p['ip.src'] || !p['ip.dst']) continue

    const key = flowKey(p)
    const time = parseFloat(p['frame.time_epoch']) || 0
    const len = parseInt(p['frame.len']) || 0
    const protoNum = parseInt(p['ip.proto']) || 0

    if (!flowMap.has(key)) {
      flowMap.set(key, {
        id: uuidv4(),
        srcIp: p['ip.src'],
        dstIp: p['ip.dst'],
        srcPort: parseInt(p['tcp.srcport'] || p['udp.srcport']) || null,
        dstPort: parseInt(p['tcp.dstport'] || p['udp.dstport']) || null,
        proto: PROTO_NAME[protoNum] || p['_ws.col.Protocol'] || `PROTO_${protoNum}`,
        protoNum,
        startTime: time,
        endTime: time,
        packetCount: 0,
        byteCount: 0,
        flags: { syn: 0, ack: 0, fin: 0, reset: 0, push: 0 },
        dnsQueries: [],
        dnsRespLengths: [],
        httpMethods: [],
        httpHosts: [],
        icmpTypes: [],
        retransmissions: 0,
        dupAcks: 0,
        zeroWindows: 0,
        ackLostSegment: 0,
        outOfOrder: 0,
        frameProtocols: '',
      })
    }

    const f = flowMap.get(key)
    f.packetCount++
    f.byteCount += len
    if (time > 0 && time < f.startTime) f.startTime = time
    if (time > f.endTime) f.endTime = time

    if (p['tcp.flags.syn'] === '1') f.flags.syn++
    if (p['tcp.flags.ack'] === '1') f.flags.ack++
    if (p['tcp.flags.fin'] === '1') f.flags.fin++
    if (p['tcp.flags.reset'] === '1') f.flags.reset++
    if (p['tcp.flags.push'] === '1') f.flags.push++

    if (p['tcp.analysis.retransmission'] === '1') f.retransmissions++
    if (p['tcp.analysis.duplicate_ack'] === '1') f.dupAcks++
    if (p['tcp.analysis.zero_window'] === '1') f.zeroWindows++
    if (p['tcp.analysis.ack_lost_segment'] === '1') f.ackLostSegment++
    if (p['tcp.analysis.out_of_order'] === '1') f.outOfOrder++

    if (!f.frameProtocols && p['frame.protocols']) f.frameProtocols = p['frame.protocols']

    if (p['dns.qry.name']) f.dnsQueries.push(p['dns.qry.name'])
    if (p['dns.resp.len']) f.dnsRespLengths.push(parseInt(p['dns.resp.len']))
    if (p['http.request.method']) f.httpMethods.push(p['http.request.method'])
    if (p['http.host']) f.httpHosts.push(p['http.host'])
    if (p['icmp.type']) f.icmpTypes.push(parseInt(p['icmp.type']))
  }

  return Array.from(flowMap.values()).map(f => {
    const retrxRate = f.packetCount > 0 ? f.retransmissions / f.packetCount : 0
    return {
      ...f,
      duration: Math.max(0, f.endTime - f.startTime),
      avgPacketSize: f.packetCount > 0 ? Math.round(f.byteCount / f.packetCount) : 0,
      hasDns: f.dnsQueries.length > 0,
      hasHttp: f.httpMethods.length > 0,
      dnsQueries: [...new Set(f.dnsQueries)],
      httpHosts: [...new Set(f.httpHosts)],
      httpMethods: [...new Set(f.httpMethods)],
      tcpState: f.proto === 'TCP' ? inferTcpState(f.flags) : null,
      retransmissionRate: parseFloat(retrxRate.toFixed(3)),
      serviceName: WELL_KNOWN_PORTS[f.dstPort] || null,
      isEncrypted: ENCRYPTED_PORTS.has(f.dstPort),
    }
  })
}

// ─── IP INVENTORY ─────────────────────────────────────────────────────────────

export function analyzeIPs(flows) {
  const ipMap = new Map()

  const getOrCreate = (ip) => {
    if (!ipMap.has(ip)) {
      ipMap.set(ip, {
        ip,
        isInternal: isInternal(ip),
        bytesSent: 0,
        bytesReceived: 0,
        packetsSent: 0,
        packetsReceived: 0,
        peersContacted: new Set(),
        peersReceivedFrom: new Set(),
        portsServedOn: new Set(),
        portsUsedAsClient: new Set(),
        protocols: new Set(),
        sessionsSent: 0,
        sessionsReceived: 0,
      })
    }
    return ipMap.get(ip)
  }

  for (const f of flows) {
    const src = getOrCreate(f.srcIp)
    src.bytesSent += f.byteCount
    src.packetsSent += f.packetCount
    src.peersContacted.add(f.dstIp)
    if (f.srcPort) src.portsUsedAsClient.add(f.srcPort)
    src.protocols.add(f.proto)
    src.sessionsSent++

    const dst = getOrCreate(f.dstIp)
    dst.bytesReceived += f.byteCount
    dst.packetsReceived += f.packetCount
    dst.peersReceivedFrom.add(f.srcIp)
    if (f.dstPort) dst.portsServedOn.add(f.dstPort)
    dst.protocols.add(f.proto)
    dst.sessionsReceived++
  }

  return Array.from(ipMap.values()).map(e => {
    const peers = new Set([...e.peersContacted, ...e.peersReceivedFrom])
    const wellKnownServed = [...e.portsServedOn].filter(p => p < 1024 || WELL_KNOWN_PORTS[p])

    let role
    if (e.portsServedOn.size > 0 && wellKnownServed.length > 0 && e.sessionsSent < e.sessionsReceived * 0.2) {
      role = 'server'
    } else if ([...e.portsServedOn].includes(53)) {
      role = 'dns_server'
    } else if (e.sessionsReceived === 0 || e.sessionsSent / (e.sessionsReceived + 1) > 4) {
      role = 'client'
    } else if (e.isInternal && [...e.peersContacted].some(p => !isInternal(p))) {
      role = 'gateway_client'
    } else {
      role = 'mixed'
    }

    return {
      ip: e.ip,
      isInternal: e.isInternal,
      role,
      bytesSent: e.bytesSent,
      bytesReceived: e.bytesReceived,
      totalBytes: e.bytesSent + e.bytesReceived,
      packetsSent: e.packetsSent,
      packetsReceived: e.packetsReceived,
      uniquePeers: peers.size,
      peersContacted: [...e.peersContacted],
      portsServedOn: [...e.portsServedOn].sort((a, b) => a - b),
      serviceNames: [...e.portsServedOn].map(p => WELL_KNOWN_PORTS[p]).filter(Boolean),
      protocols: [...e.protocols],
      sessionsSent: e.sessionsSent,
      sessionsReceived: e.sessionsReceived,
    }
  }).sort((a, b) => b.totalBytes - a.totalBytes)
}

// ─── CONNECTION MAP ────────────────────────────────────────────────────────────

export function buildConnectionMap(flows) {
  const pairMap = new Map()

  for (const f of flows) {
    // Normalize key so A↔B and B↔A merge into one pair
    const [a, b] = f.srcIp < f.dstIp
      ? [f.srcIp, f.dstIp]
      : [f.dstIp, f.srcIp]
    const key = `${a}|${b}`

    if (!pairMap.has(key)) {
      pairMap.set(key, {
        ipA: a,
        ipB: b,
        protocols: new Set(),
        ports: new Set(),
        totalBytes: 0,
        totalPackets: 0,
        sessionCount: 0,
        established: 0,
        halfOpen: 0,
        reset: 0,
        gracefulClose: 0,
        retransmissions: 0,
        services: new Set(),
      })
    }

    const pair = pairMap.get(key)
    pair.protocols.add(f.proto)
    if (f.dstPort) pair.ports.add(f.dstPort)
    pair.totalBytes += f.byteCount
    pair.totalPackets += f.packetCount
    pair.sessionCount++
    pair.retransmissions += f.retransmissions

    if (f.tcpState === 'established') pair.established++
    else if (f.tcpState === 'half_open') pair.halfOpen++
    else if (f.tcpState === 'reset') pair.reset++
    else if (f.tcpState === 'graceful_close') pair.gracefulClose++

    if (f.serviceName) pair.services.add(f.serviceName)
  }

  return Array.from(pairMap.values())
    .map(p => ({
      ...p,
      protocols: [...p.protocols],
      ports: [...p.ports].sort((a, b) => a - b),
      services: [...p.services],
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
}

// ─── FLOW SUMMARY ─────────────────────────────────────────────────────────────

export function summarizeFlows(flows) {
  if (flows.length === 0) return null

  const starts = flows.map(f => f.startTime).filter(Boolean)
  const ends = flows.map(f => f.endTime).filter(Boolean)

  const topFlowsByBytes = [...flows]
    .sort((a, b) => b.byteCount - a.byteCount)
    .slice(0, 10)
    .map(f => ({ src: f.srcIp, dst: f.dstIp, dstPort: f.dstPort, proto: f.proto, bytes: f.byteCount, service: f.serviceName }))

  const protoCounts = flows.reduce((acc, f) => {
    acc[f.proto] = (acc[f.proto] || 0) + 1
    return acc
  }, {})

  const protoBytes = flows.reduce((acc, f) => {
    acc[f.proto] = (acc[f.proto] || 0) + f.byteCount
    return acc
  }, {})

  const totalBytes = flows.reduce((s, f) => s + f.byteCount, 0)
  const encryptedBytes = flows
    .filter(f => f.isEncrypted)
    .reduce((s, f) => s + f.byteCount, 0)

  const totalRetransmissions = flows.reduce((s, f) => s + f.retransmissions, 0)
  const totalPackets = flows.reduce((s, f) => s + f.packetCount, 0)

  const tcpFlows = flows.filter(f => f.proto === 'TCP')
  const sessionStats = {
    established: tcpFlows.filter(f => f.tcpState === 'established').length,
    halfOpen: tcpFlows.filter(f => f.tcpState === 'half_open').length,
    reset: tcpFlows.filter(f => f.tcpState === 'reset').length,
    gracefulClose: tcpFlows.filter(f => f.tcpState === 'graceful_close').length,
    unknown: tcpFlows.filter(f => f.tcpState === 'unknown').length,
  }

  const ipInventory = analyzeIPs(flows)
  const connectionMap = buildConnectionMap(flows).slice(0, 20)

  return {
    flowCount: flows.length,
    totalPackets,
    totalBytes,
    uniqueSrcIps: [...new Set(flows.map(f => f.srcIp))],
    uniqueDstIps: [...new Set(flows.map(f => f.dstIp))],
    protocols: protoCounts,
    protocolByBytes: protoBytes,
    encryptedBytes,
    encryptedRatio: totalBytes > 0 ? parseFloat((encryptedBytes / totalBytes).toFixed(3)) : 0,
    captureStart: starts.length ? Math.min(...starts) : 0,
    captureEnd: ends.length ? Math.max(...ends) : 0,
    captureDuration: starts.length && ends.length
      ? Math.max(...ends) - Math.min(...starts)
      : 0,
    topFlowsByBytes,
    sessionStats,
    retransmissionTotal: totalRetransmissions,
    retransmissionRate: totalPackets > 0 ? parseFloat((totalRetransmissions / totalPackets).toFixed(4)) : 0,
    ackLostSegmentTotal: flows.reduce((s, f) => s + (f.ackLostSegment || 0), 0),
    outOfOrderTotal: flows.reduce((s, f) => s + (f.outOfOrder || 0), 0),
    ipInventory,
    connectionMap,
  }
}
