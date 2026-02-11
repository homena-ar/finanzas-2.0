'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Calendar } from 'lucide-react'

interface MonthYearPickerProps {
  value: string | null // Format: YYYY-MM-DD (will use day 10)
  onChange: (date: string) => void // Returns YYYY-MM-DD format
  label?: string
  className?: string
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

export function MonthYearPicker({ value, onChange, label, className = '' }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (value) {
      const [, month] = value.split('-')
      return parseInt(month) || new Date().getMonth() + 1
    }
    return new Date().getMonth() + 1
  })
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (value) {
      const [year] = value.split('-')
      return parseInt(year) || new Date().getFullYear()
    }
    return new Date().getFullYear()
  })

  // Sync state when value prop changes externally
  useEffect(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number)
      if (year && month) {
        setSelectedYear(year)
        setSelectedMonth(month)
      }
    }
  }, [value])
  const [searchMonth, setSearchMonth] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate years (current year ± 5 years)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  // Filter months based on search
  const filteredMonths = MONTHS.filter(m =>
    m.label.toLowerCase().includes(searchMonth.toLowerCase())
  )

  // Filter years based on search
  const filteredYears = years.filter(y =>
    String(y).includes(searchYear)
  )

  // Update parent when selection changes (but not on initial mount if value is provided)
  const isInitialMount = useRef(true)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  
  useEffect(() => {
    if (isInitialMount.current && value) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-10`
    onChangeRef.current(dateStr)
  }, [selectedMonth, selectedYear])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchMonth('')
        setSearchYear('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const displayText = value
    ? `${MONTHS[selectedMonth - 1]?.label} de ${selectedYear}`
    : 'Seleccionar mes'

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month)
    setSearchMonth('')
  }

  const handleYearSelect = (year: number) => {
    setSelectedYear(year)
    setSearchYear('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm font-medium text-slate-700 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>{displayText}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 min-w-[280px]">
          <div className="grid grid-cols-2 gap-3">
            {/* Month Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Mes</label>
              <input
                type="text"
                placeholder="Buscar mes..."
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="input input-sm mb-2 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded">
                {filteredMonths.map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => handleMonthSelect(month.value)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors ${
                      selectedMonth === month.value
                        ? 'bg-primary-100 text-primary-700 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Año</label>
              <input
                type="text"
                placeholder="Buscar año..."
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="input input-sm mb-2 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded">
                {filteredYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearSelect(year)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors ${
                      selectedYear === year
                        ? 'bg-primary-100 text-primary-700 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
