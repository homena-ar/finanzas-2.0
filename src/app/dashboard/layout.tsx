'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { 
  LayoutDashboard, CreditCard, Wallet, TrendingUp, 
  PiggyBank, Settings, LogOut, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatMoney, getMonthName, fetchDolar } from '@/lib/utils'
import { useData } from '@/hooks/useData'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Resumen' },
  { href: '/dashboard/gastos', icon: CreditCard, label: 'Gastos' },
  { href: '/dashboard/tarjetas', icon: Wallet, label: 'Tarjetas' },
  { href: '/dashboard/proyeccion', icon: TrendingUp, label: 'Proyección' },
  { href: '/dashboard/ahorros', icon: PiggyBank, label: 'Ahorros' },
  { href: '/dashboard/config', icon: Settings, label: 'Config' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const { currentMonth, changeMonth } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dolar, setDolar] = useState(0)

  console.log('🏠 [DashboardLayout] Render - loading:', loading, 'user:', user ? 'EXISTS' : 'NULL')

  useEffect(() => {
    console.log('🏠 [DashboardLayout] useEffect - loading:', loading, 'user:', user ? 'EXISTS' : 'NULL')
    if (!loading && !user) {
      console.log('🏠 [DashboardLayout] No user and not loading - Redirecting to /')
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    fetchDolar()
      .then(setDolar)
      .catch(err => console.error('Error al obtener cotización del dólar:', err))
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (loading) {
    console.log('🏠 [DashboardLayout] SHOWING LOADING SPINNER')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    console.log('🏠 [DashboardLayout] No user - Returning null')
    return null
  }

  console.log('🏠 [DashboardLayout] Rendering dashboard content')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="grad-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <g fill="url(#grad-mobile)">
              <rect x="25" y="45" width="10" height="30" rx="2"/>
              <rect x="45" y="35" width="10" height="40" rx="2"/>
              <rect x="65" y="25" width="10" height="50" rx="2"/>
            </g>
          </svg>
          <span className="font-bold">FinControl</span>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
          💵 {formatMoney(dolar)}
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50
        transform transition-transform duration-200
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
                <g fill="white">
                  <rect x="25" y="45" width="10" height="30" rx="2"/>
                  <rect x="45" y="35" width="10" height="40" rx="2"/>
                  <rect x="65" y="25" width="10" height="50" rx="2"/>
                </g>
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm">FinControl</div>
              <div className="text-xs text-slate-500">{profile?.nombre}</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dolar Badge */}
        <div className="p-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700">💵 Dólar BNA</span>
            <span className="font-bold text-emerald-700">{formatMoney(dolar)}</span>
          </div>
        </div>

        {/* Month Navigator */}
        <div className="px-4 pb-4">
          <div className="bg-slate-100 rounded-xl p-2 flex items-center justify-between">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-sm">{getMonthName(currentMonth)}</span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-indigo-500 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
