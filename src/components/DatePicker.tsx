'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronUp, ChevronDown, X } from 'lucide-react'

interface DatePickerProps {
  value: string | null // Format: YYYY-MM-DD
  onChange: (date: string | null) => void // Returns YYYY-MM-DD format or null
  label?: string
  className?: string
  placeholder?: string
}

const MONTHS = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' },
]

const DAYS_OF_WEEK = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO']

export function DatePicker({ value, onChange, label, className = '', placeholder = 'dd/mm/aaaa' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      return isNaN(date.getTime()) ? null : date
    }
    return null
  })
  const [displayMonth, setDisplayMonth] = useState<number>(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      return isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth()
    }
    return new Date().getMonth()
  })
  const [displayYear, setDisplayYear] = useState<number>(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      return isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
    }
    return new Date().getFullYear()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync state when value prop changes externally
  useEffect(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        setSelectedDate(date)
        setDisplayMonth(date.getMonth())
        setDisplayYear(date.getFullYear())
      }
    } else {
      setSelectedDate(null)
    }
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1).getDay()
    // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    return firstDay === 0 ? 6 : firstDay - 1
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(displayYear, displayMonth, day)
    setSelectedDate(newDate)
    const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleToday = () => {
    const today = new Date()
    setSelectedDate(today)
    setDisplayMonth(today.getMonth())
    setDisplayYear(today.getFullYear())
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedDate(null)
    onChange(null)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11)
      setDisplayYear(displayYear - 1)
    } else {
      setDisplayMonth(displayMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0)
      setDisplayYear(displayYear + 1)
    } else {
      setDisplayMonth(displayMonth + 1)
    }
  }

  const formatDisplayDate = (date: Date | null) => {
    if (!date) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const daysInMonth = getDaysInMonth(displayMonth, displayYear)
  const firstDay = getFirstDayOfMonth(displayMonth, displayYear)
  const days: (number | null)[] = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  // Get previous month's last days for the grid
  const prevMonthDays = getDaysInMonth(displayMonth === 0 ? 11 : displayMonth - 1, displayMonth === 0 ? displayYear - 1 : displayYear)
  const prevMonthLastDays: number[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    prevMonthLastDays.push(prevMonthDays - i)
  }

  // Get next month's first days for the grid
  const remainingCells = 42 - days.length // 6 rows * 7 days
  const nextMonthFirstDays: number[] = []
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthFirstDays.push(i)
  }

  const today = new Date()
  const isToday = (day: number) => {
    return day === today.getDate() && 
           displayMonth === today.getMonth() && 
           displayYear === today.getFullYear()
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return day === selectedDate.getDate() && 
           displayMonth === selectedDate.getMonth() && 
           displayYear === selectedDate.getFullYear()
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="label text-sm mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={formatDisplayDate(selectedDate)}
          placeholder={placeholder}
          onClick={() => setIsOpen(!isOpen)}
          className="input w-full cursor-pointer pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {selectedDate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <Calendar className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-4 min-w-[320px]">
          {/* Month/Year Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <select
                value={displayMonth}
                onChange={(e) => setDisplayMonth(Number(e.target.value))}
                className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <span className="text-sm font-semibold text-slate-700">de</span>
              <select
                value={displayYear}
                onChange={(e) => setDisplayYear(Number(e.target.value))}
                className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ChevronUp className="w-4 h-4 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ChevronDown className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-600 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Previous month days */}
            {prevMonthLastDays.map((day) => (
              <div
                key={`prev-${day}`}
                className="aspect-square flex items-center justify-center text-xs text-slate-300 cursor-default"
              >
                {day}
              </div>
            ))}
            
            {/* Current month days */}
            {days.map((day, index) => {
              if (day === null) return null
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`aspect-square flex items-center justify-center text-sm rounded transition-colors ${
                    isSelected(day)
                      ? 'bg-primary-600 text-white font-semibold border-2 border-primary-800'
                      : isToday(day)
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {day}
                </button>
              )
            })}

            {/* Next month days */}
            {nextMonthFirstDays.slice(0, 42 - days.length).map((day) => (
              <div
                key={`next-${day}`}
                className="aspect-square flex items-center justify-center text-xs text-slate-300 cursor-default"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded hover:bg-slate-100"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-sm text-primary-600 hover:text-primary-800 px-3 py-1.5 rounded hover:bg-primary-50 font-medium"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
