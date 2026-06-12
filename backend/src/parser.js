import { spawn } from 'child_process'

const FIELDS = [
  'frame.number',
  'frame.time_epoch',
  'frame.len',
  'ip.src',
  'ip.dst',
  'ip.proto',
  'tcp.srcport',
  'tcp.dstport',
  'tcp.flags.syn',
  'tcp.flags.ack',
  'tcp.flags.fin',
  'tcp.flags.reset',
  'tcp.flags.push',
  'udp.srcport',
  'udp.dstport',
  'icmp.type',
  'dns.qry.name',
  'dns.resp.len',
  'http.request.method',
  'http.host',
  '_ws.col.Protocol',
  'tcp.analysis.retransmission',
  'tcp.analysis.duplicate_ack',
  'tcp.analysis.zero_window',
  'tcp.analysis.ack_lost_segment',
  'tcp.analysis.out_of_order',
  'frame.protocols',
]

export function parseCapture(filePath) {
  return new Promise((resolve, reject) => {
    const TSHARK = process.env.TSHARK_PATH || 'tshark'
    const args = [
      '-r', filePath,
      '-T', 'fields',
      '-E', 'header=y',
      '-E', 'separator=\t',
      '-E', 'occurrence=f',
      ...FIELDS.flatMap(f => ['-e', f])
    ]

    const proc = spawn(TSHARK, args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', chunk => { stdout += chunk })
    proc.stderr.on('data', chunk => { stderr += chunk })

    proc.on('close', code => {
      // tshark exits 0 or 1 — stderr warnings are normal (interface notices etc.)
      if (code > 1 && !stdout) {
        return reject(new Error(`tshark failed (exit ${code}): ${stderr.slice(0, 300)}`))
      }

      const lines = stdout.trim().split('\n')
      if (lines.length < 2) return resolve([])

      const headers = lines[0].split('\t')
      const packets = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const values = lines[i].split('\t')
        const packet = {}
        headers.forEach((h, idx) => { packet[h] = values[idx] ?? '' })
        packets.push(packet)
      }

      resolve(packets)
    })

    proc.on('error', err => {
      reject(new Error(`Cannot run tshark — is Wireshark installed and tshark in PATH? (${err.message})`))
    })
  })
}
