import { useState, useRef, useCallback } from 'react'

export function useResize(initial, min = 100, max = 800) {
  const [size, setSize] = useState(initial)
  const sizeRef = useRef(initial)
  sizeRef.current = size

  const startDrag = useCallback((e, axis = 'x', invert = false) => {
    e.preventDefault()
    const startPos = axis === 'x' ? e.clientX : e.clientY
    const startSize = sizeRef.current

    const onMove = (ev) => {
      const delta = (axis === 'x' ? ev.clientX : ev.clientY) - startPos
      const next = Math.max(min, Math.min(max, startSize + (invert ? -delta : delta)))
      setSize(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [min, max])

  return [size, startDrag]
}
