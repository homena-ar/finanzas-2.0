'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Wallet, TrendingUp,
  PiggyBank, Settings, LogOut, Menu, X, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Building2, ChevronDown, Shield, UserCheck
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatMoney, getMonthName, fetchDolar } from '@/lib/utils'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import type { Workspace, WorkspacePermissions } from '@/types'
import { NotificationsBell } from '@/components/NotificationsBell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const { currentMonth, changeMonth } = useData()
  const { workspaces, currentWorkspace, setCurrentWorkspace, members, loading: workspaceLoading, initWorkspaceReady, ensurePersonalWorkspace } = useWorkspace()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [dolar, setDolar] = useState(0)

  // --- LÓGICA DE PERMISOS MEJORADA ---
  const hasAccess = (section: keyof WorkspacePermissions) => {
    // 1. Espacio Personal: Siempre acceso total
    if (!currentWorkspace) {
      console.log('🔒 [Layout] Sin workspace - acceso completo a', section)
      return true
    }
    
    // 2. Dueño del Workspace: Siempre acceso total (Failsafe anti-bloqueo)
    if (currentWorkspace.owner_id === user?.uid) {
      console.log('🔒 [Layout] Usuario es dueño - acceso completo a', section)
      return true
    }

    // 3. Si aún están cargando los miembros, asumimos acceso temporal para evitar ocultar pestañas
    if (workspaceLoading) {
      console.log('🔒 [Layout] Cargando miembros - acceso temporal a', section)
      return true
    }

    // 4. Colaborador: Verificar permisos en la lista de miembros
    console.log('🔒 [Layout] Buscando miembro - workspace:', currentWorkspace.id, 'usuario:', user?.uid, 'total miembros:', members.length)
    console.log('🔒 [Layout] Miembros disponibles:', members.map(m => ({ workspace_id: m.workspace_id, user_id: m.user_id, permissions: m.permissions })))
    
    const member = members.find(m => m.workspace_id === currentWorkspace.id && m.user_id === user?.uid)
    
    if (!member) {
      console.log('🔒 [Layout] ❌ No se encontró miembro para workspace', currentWorkspace.id, 'usuario', user?.uid)
      console.log('🔒 [Layout] Miembros en lista:', members.map(m => ({ id: m.id, workspace_id: m.workspace_id, user_id: m.user_id })))
      // Si no hay miembros cargados pero el workspace está activo, asumir acceso temporal
      if (members.length === 0) {
        console.log('🔒 [Layout] ⚠️ Lista de miembros vacía, acceso temporal a', section)
        return true
      }
      return false 
    }

    const hasPermission = member.permissions[section] !== 'ninguno'
    console.log('🔒 [Layout] ✅ Permiso para', section, ':', member.permissions[section], '->', hasPermission)
    return hasPermission
  }

  // Nombre del espacio personal (desde perfil o default)
  const personalWorkspaceName = profile?.personal_workspace_name || 'Espacio Personal'
  const personalWorkspaceIcono = profile?.personal_workspace_icono || null
  const personalWorkspaceLogo = profile?.personal_workspace_logo || null

  // Build navigation items based on permissions
  // Para ingresos: verificar configuración del workspace o perfil según corresponda
  const showIngresos = currentWorkspace 
    ? (currentWorkspace.ingresos_habilitado && hasAccess('ingresos')) // En workspace: verificar configuración y permisos
    : (profile?.ingresos_habilitado && hasAccess('ingresos')) // En espacio personal: verificar configuración y permisos
  
  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Resumen' }, // Siempre visible
    
    ...(hasAccess('gastos') ? [{ href: '/dashboard/gastos', icon: ArrowDownCircle, label: 'Gastos' }] : []),
    
    ...(showIngresos ? [{ href: '/dashboard/ingresos', icon: ArrowUpCircle, label: 'Ingresos' }] : []),
    
    ...(hasAccess('tarjetas') ? [{ href: '/dashboard/tarjetas', icon: Wallet, label: 'Cuentas' }] : []),
    
    ...(hasAccess('gastos') ? [{ href: '/dashboard/proyeccion', icon: TrendingUp, label: 'Proyección' }] : []),
    
    ...(hasAccess('ahorros') ? [{ href: '/dashboard/ahorros', icon: PiggyBank, label: 'Ahorros' }] : []),
    
    { href: '/dashboard/config', icon: Settings, label: 'Config' },
  ]

  console.log('🏠 [DashboardLayout] Render - user:', user?.uid)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    } else if (user && !user.emailVerified) {
      // Si el usuario no tiene el correo verificado, redirigir a la página de verificación
      router.push('/verificar-email')
    }
  }, [user, loading, router])

  useEffect(() => {
    fetchDolar()
      .then(setDolar)
      .catch(err => console.error('Error al obtener cotización del dólar:', err))
  }, [])

  // Close workspace dropdown when sidebar closes
  useEffect(() => {
    if (!sidebarOpen) {
      setWorkspaceDropdownOpen(false)
    }
  }, [sidebarOpen])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (user && !initWorkspaceReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        <p className="text-slate-600">Cargando tu espacio…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1 mx-2">
          {currentWorkspace?.logo ? (
            <img src={currentWorkspace.logo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
          ) : currentWorkspace?.icono ? (
            <span className="text-2xl shrink-0">{currentWorkspace.icono}</span>
          ) : personalWorkspaceLogo ? (
            <img src={personalWorkspaceLogo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
          ) : personalWorkspaceIcono ? (
            <span className="text-2xl shrink-0">{personalWorkspaceIcono}</span>
          ) : (
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 100 100" fill="none">
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
          )}
          <div className="min-w-0 overflow-hidden">
            <span className="font-bold block">FinControl</span>
            {currentWorkspace ? (
              <span className="text-[10px] text-indigo-600 font-medium truncate block">{currentWorkspace.name}</span>
            ) : (
              <span className="text-[10px] text-slate-500 font-medium truncate block">{personalWorkspaceName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold shrink-0">
            💵 {formatMoney(dolar)}
          </div>
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

        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className={`w-full border rounded-xl p-3 flex items-center justify-between hover:bg-slate-100 transition-colors ${
                (currentWorkspace && currentWorkspace.id !== profile?.personal_workspace_id) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {/* Avatar del espacio (logo > emoji > inicial) */}
                {(currentWorkspace && currentWorkspace.id !== profile?.personal_workspace_id) ? (
                  currentWorkspace.logo ? (
                    <img src={currentWorkspace.logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                  ) : currentWorkspace.icono ? (
                    <div className="w-8 h-8 rounded-lg bg-white/60 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-xl">{currentWorkspace.icono}</span>
                    </div>
                  ) : (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 ${
                      currentWorkspace.owner_id === user.uid ? 'bg-indigo-500' : 'bg-purple-500'
                    }`}>
                      {currentWorkspace.name.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : personalWorkspaceLogo ? (
                  <img src={personalWorkspaceLogo} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                ) : personalWorkspaceIcono ? (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                    <span className="text-xl">{personalWorkspaceIcono}</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                )}
                <div className="text-left overflow-hidden">
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    {currentWorkspace?.id === profile?.personal_workspace_id ? 'Espacio Personal' : currentWorkspace ? (currentWorkspace.owner_id === user.uid ? 'Propietario' : 'Colaborador') : 'Espacio Personal'}
                  </div>
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {currentWorkspace?.name ?? personalWorkspaceName}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${workspaceDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {workspaceDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                {/* Personal Option (workspace real type=personal) */}
                <button
                  onClick={() => {
                    ;(async () => {
                      try {
                        const id = await ensurePersonalWorkspace()
                        const personalWs = workspaces.find(w => w.id === id)
                        if (personalWs) {
                          setCurrentWorkspace(personalWs)
                        } else if (user) {
                          const stub: Workspace = {
                            id,
                            name: personalWorkspaceName,
                            owner_id: user.uid,
                            type: 'personal',
                            icono: personalWorkspaceIcono,
                            logo: personalWorkspaceLogo,
                            ingresos_habilitado: profile?.ingresos_habilitado ?? false,
                            created_at: new Date().toISOString(),
                          }
                          setCurrentWorkspace(stub)
                        }
                      } finally {
                        setWorkspaceDropdownOpen(false)
                      }
                    })()
                  }}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between
                    ${currentWorkspace?.id === profile?.personal_workspace_id ? 'bg-slate-100' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 overflow-hidden">
                      {personalWorkspaceLogo ? (
                        <img src={personalWorkspaceLogo} alt="Logo" className="w-full h-full object-cover" />
                      ) : personalWorkspaceIcono ? (
                        <span className="text-xl">{personalWorkspaceIcono}</span>
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{personalWorkspaceName}</div>
                      <div className="text-[10px] text-slate-500">Privado</div>
                    </div>
                  </div>
                  {currentWorkspace?.id === profile?.personal_workspace_id && (
                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  )}
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                {/* Workspaces (excluir el personal, que está arriba) */}
                {workspaces.filter(w => w.type !== 'personal').map((workspace) => {
                  const isOwner = workspace.owner_id === user?.uid
                  return (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        setCurrentWorkspace(workspace)
                        setWorkspaceDropdownOpen(false)
                      }}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between
                        ${currentWorkspace?.id === workspace.id ? (isOwner ? 'bg-indigo-50' : 'bg-purple-50') : ''}
                      `}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                          workspace.logo || workspace.icono ? 'bg-transparent' : (isOwner ? 'bg-indigo-500' : 'bg-purple-500')
                        }`}>
                          {workspace.logo ? (
                            <img src={workspace.logo} alt="Logo" className="w-full h-full object-cover border border-slate-200 rounded-lg" />
                          ) : workspace.icono ? (
                            <span className="text-xl">{workspace.icono}</span>
                          ) : (
                            <span className="text-white font-bold">{workspace.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-slate-900 truncate">{workspace.name}</div>
                          <div className={`text-[10px] font-bold uppercase ${isOwner ? 'text-indigo-600' : 'text-purple-600'}`}>
                            {isOwner ? 'Propietario' : 'Colaborador'}
                          </div>
                        </div>
                      </div>
                      {currentWorkspace?.id === workspace.id && (
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isOwner ? 'bg-indigo-600' : 'bg-purple-600'}`} />
                      )}
                    </button>
                  )
                })}
                
                {workspaces.filter(w => w.type !== 'personal').length === 0 && (
                  <div className="px-4 py-3 text-xs text-center text-slate-400">
                    No tenés espacios colaborativos
                  </div>
                )}
              </div>
            )}
          </div>
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
        <nav className="px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-320px)]">
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

      {/* Desktop Header */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-30 items-center justify-end px-6 gap-4">
        <NotificationsBell />
        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
          💵 {formatMoney(dolar)}
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
