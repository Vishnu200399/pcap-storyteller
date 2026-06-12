export function ResizeHandle({ onMouseDown, axis = 'x' }) {
  const isRow = axis === 'y'
  return (
    <div
      onMouseDown={onMouseDown}
      className={[
        'group flex-shrink-0 relative z-10 flex items-center justify-center select-none',
        isRow
          ? 'h-2 w-full cursor-row-resize'
          : 'w-2 h-full cursor-col-resize',
      ].join(' ')}
    >
      {/* Track line */}
      <div className={[
        'absolute transition-all duration-150 rounded-full',
        isRow
          ? 'h-px w-full bg-slate-800 group-hover:h-[3px] group-hover:bg-blue-500/50 group-active:bg-blue-400'
          : 'w-px h-full bg-slate-800 group-hover:w-[3px] group-hover:bg-blue-500/50 group-active:bg-blue-400',
      ].join(' ')} />
      {/* Grip dots */}
      <div className={[
        'absolute flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        isRow ? 'flex-row' : 'flex-col',
      ].join(' ')}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-0.5 h-0.5 rounded-full bg-blue-400/70" />
        ))}
      </div>
    </div>
  )
}
