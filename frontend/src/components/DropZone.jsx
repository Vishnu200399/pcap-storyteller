import { useState, useRef } from 'react'

const VALID_EXTS = ['.pcap', '.pcapng', '.cap']
const MAX_BYTES = 100 * 1024 * 1024

function fmtSize(b) {
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b > 1e3) return `${(b / 1e3).toFixed(0)} KB`
  return `${b} B`
}

function validate(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!VALID_EXTS.includes(ext)) return `Invalid type. Accepted: ${VALID_EXTS.join(', ')}`
  if (file.size > MAX_BYTES) return 'File too large. Maximum size is 100 MB.'
  return null
}

export function DropZone({ onAnalyze, disabled }) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const inputRef = useRef(null)

  function pick(f) {
    const err = validate(f)
    setFileError(err)
    setFile(err ? null : f)
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Drop target */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) pick(e.dataTransfer.files[0])
        }}
        className={[
          'relative border-2 border-dashed rounded-2xl p-8 sm:p-14 text-center transition-all duration-200 outline-none',
          disabled
            ? 'border-slate-700 opacity-40 cursor-not-allowed'
            : dragOver
              ? 'border-blue-400 bg-blue-500/5 scale-[1.01] cursor-copy'
              : file
                ? 'border-blue-600/60 bg-slate-900 cursor-pointer hover:border-blue-500/80'
                : 'border-slate-700 bg-slate-900 cursor-pointer hover:border-slate-500 hover:bg-slate-800/50',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pcap,.pcapng,.cap"
          className="hidden"
          onChange={e => { if (e.target.files[0]) pick(e.target.files[0]) }}
          disabled={disabled}
        />

        {/* Icon */}
        <div className={[
          'mx-auto w-16 h-16 mb-5 rounded-2xl flex items-center justify-center transition-colors',
          dragOver ? 'bg-blue-500/20' : 'bg-slate-800',
        ].join(' ')}>
          {file ? (
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className={`w-8 h-8 ${dragOver ? 'text-blue-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        {file ? (
          <div>
            <p className="text-white font-semibold text-lg mb-1 font-mono truncate px-4">{file.name}</p>
            <p className="text-slate-400 text-sm">{fmtSize(file.size)}</p>
            <p className="text-slate-600 text-xs mt-2">Click to choose a different file</p>
          </div>
        ) : (
          <div>
            <p className="text-slate-200 font-semibold text-lg mb-1">
              {dragOver ? 'Release to load' : 'Drop your capture here'}
            </p>
            <p className="text-slate-500 text-sm mb-4">or click to browse</p>
            <div className="flex items-center justify-center gap-2">
              {VALID_EXTS.map(ext => (
                <span key={ext} className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono">
                  {ext}
                </span>
              ))}
            </div>
            <p className="text-slate-600 text-xs mt-3">Max 100 MB</p>
          </div>
        )}
      </div>

      {fileError && (
        <p className="text-red-400 text-sm text-center px-2">{fileError}</p>
      )}

      {file && !fileError && (
        <button
          onClick={() => onAnalyze(file)}
          disabled={disabled}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base
            transition-colors duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Analyze Capture
        </button>
      )}
    </div>
  )
}
