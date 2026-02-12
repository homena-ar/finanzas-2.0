'use client'

// ============================================
// KEYBOARD VIEWPORT HOOK
// ============================================
// Escucha window.visualViewport para adaptar el layout
// cuando el teclado virtual se abre en mobile.
// Expone la altura visible real y un offset para inputs.

import { useState, useEffect, useCallback } from 'react'

export interface KeyboardViewportState {
  /** Altura visible real del viewport (sin teclado) */
  viewportHeight: number
  /** Offset Y desde el top del viewport visual */
  offsetTop: number
  /** true cuando el teclado está abierto (viewport es menor que la ventana) */
  isKeyboardOpen: boolean
  /** Altura estimada del teclado */
  keyboardHeight: number
}

export function useKeyboardViewport(): KeyboardViewportState {
  const [state, setState] = useState<KeyboardViewportState>({
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    offsetTop: 0,
    isKeyboardOpen: false,
    keyboardHeight: 0,
  })

  const update = useCallback(() => {
    const vv = window.visualViewport
    if (!vv) {
      setState({
        viewportHeight: window.innerHeight,
        offsetTop: 0,
        isKeyboardOpen: false,
        keyboardHeight: 0,
      })
      return
    }

    const fullHeight = window.innerHeight
    const visibleHeight = vv.height
    const kbHeight = Math.max(0, fullHeight - visibleHeight)
    const isOpen = kbHeight > 100 // umbral para evitar falsos positivos

    setState({
      viewportHeight: visibleHeight,
      offsetTop: vv.offsetTop,
      isKeyboardOpen: isOpen,
      keyboardHeight: kbHeight,
    })

    // CSS custom property para uso global
    document.documentElement.style.setProperty(
      '--viewport-height',
      `${visibleHeight}px`
    )
    document.documentElement.style.setProperty(
      '--keyboard-height',
      `${kbHeight}px`
    )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    }
    window.addEventListener('resize', update)

    // Inicializar
    update()

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
    }
  }, [update])

  return state
}
