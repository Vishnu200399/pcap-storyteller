import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import multer from 'multer'
import { mkdirSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { parseCapture } from './parser.js'
import { extractFlows, summarizeFlows } from './flows.js'
import { scoreAnomalies } from './anomalies.js'
import { narrateCapture } from './narrator.js'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', 'uploads')

mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// In-memory job store (jobId -> job metadata)
const jobs = new Map()

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
    cb(null, ['.pcap', '.pcapng', '.cap'].includes(ext))
  },
  limits: { fileSize: 100 * 1024 * 1024 }
})

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }))

app.post('/upload', upload.single('pcap'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid pcap file provided (.pcap, .pcapng, .cap only)' })
  }
  const jobId = uuidv4()
  jobs.set(jobId, {
    filePath: req.file.path,
    originalName: req.file.originalname,
    size: req.file.size,
    uploadedAt: Date.now(),
  })
  res.json({ jobId, originalName: req.file.originalname, size: req.file.size })
})

// SSE streaming analysis endpoint
app.get('/analyze/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    send('progress', { step: 'parsing', message: 'Parsing packets with tshark...' })
    const packets = await parseCapture(job.filePath)
    send('progress', {
      step: 'parsed',
      message: `Parsed ${packets.length.toLocaleString()} packets`,
      packetCount: packets.length,
    })

    // Count all application-layer protocol labels across every packet
    const allProtocols = {}
    for (const p of packets) {
      const proto = p['_ws.col.Protocol']?.trim()
      if (proto) allProtocols[proto] = (allProtocols[proto] || 0) + 1
    }

    send('progress', { step: 'flows', message: 'Extracting network flows...' })
    const flows = extractFlows(packets)
    const summary = summarizeFlows(flows)
    if (summary) summary.allProtocols = allProtocols
    send('progress', {
      step: 'extracted',
      message: `Extracted ${flows.length.toLocaleString()} flows`,
      flowCount: flows.length,
    })

    send('progress', { step: 'scoring', message: 'Scoring anomalies...' })
    const anomalies = scoreAnomalies(flows)
    send('progress', {
      step: 'scored',
      message: `Found ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'}`,
      anomalyCount: anomalies.length,
    })

    send('progress', { step: 'narrating', message: 'Building analysis narrative...' })
    let narrative = ''
    for await (const token of narrateCapture(summary, anomalies)) {
      narrative += token
      send('token', { token })
    }

    send('complete', { flows, summary, anomalies, narrative, jobId: req.params.jobId })
  } catch (err) {
    send('error', { message: err.message })
  } finally {
    res.end()
  }
})

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
