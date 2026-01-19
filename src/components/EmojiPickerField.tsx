'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { ssr: false }
)

type EmojiPickerFieldProps = {
  value: string
  onChange: (emoji: string) => void
  placeholder?: string
  /** Tamaño: 'sm' | 'md' */
  size?: 'sm' | 'md'
  /** Clases extra para el botón que abre el picker */
  className?: string
}

export function EmojiPickerField({
  value,
  onChange,
  placeholder = '😀',
  size = 'md',
  className = ''
}: EmojiPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('click', fn)
      return () => document.removeEventListener('click', fn)
    }
  }, [open])

  const sizeClasses = size === 'sm' ? 'w-10 h-10 text-lg' : 'w-12 h-12 text-2xl'

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`${sizeClasses} rounded-xl border-2 border-slate-200 hover:border-indigo-400 bg-white flex items-center justify-center transition shadow-sm ${className}`}
            title="Abrir selector de emojis"
          >
            {value || placeholder}
          </button>
          <input
            type="text"
            className="flex-1 min-w-0 text-center text-lg border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 max-w-[5rem]"
            placeholder="o pegar"
            value={value}
            onChange={e => onChange(e.target.value)}
            maxLength={4}
          />
        </div>
        {open && (
          <div className="absolute top-full left-0 z-[100] mt-1 shadow-xl rounded-xl overflow-hidden border border-slate-200 bg-white">
            <EmojiPicker
              onEmojiClick={(data: { emoji: string }) => {
                onChange(data.emoji)
                setOpen(false)
              }}
              searchPlaceholder="Buscar emoji..."
              width={320}
              height={360}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}
