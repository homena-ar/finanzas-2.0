'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Wallet, TrendingUp,
  PiggyBank, Settings, LogOut, Menu, X, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Building2, ChevronDown, Shield, UserCheck, Bell, ShoppingCart
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
  const { workspaces, currentWorkspace, setCurrentWorkspace, members, loading: workspaceLoading, initWorkspaceReady } = useWorkspace()
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

    { href: '/dashboard/recordatorios', icon: Bell, label: 'Recordatorios' },

    { href: '/dashboard/listas', icon: ShoppingCart, label: 'Listas' },

    { href: '/dashboard/config', icon: Settings, label: 'Config' },
  ]

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
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (user && !initWorkspaceReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-slate-600">Cargando tu espacio…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 flex items-center justify-between px-3">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Abrir menú">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1 mx-2">
          {currentWorkspace?.logo ? (
            <img src={currentWorkspace.logo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
          ) : currentWorkspace?.icono ? (
            <span className="text-xl shrink-0">{currentWorkspace.icono}</span>
          ) : personalWorkspaceLogo ? (
            <img src={personalWorkspaceLogo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
          ) : personalWorkspaceIcono ? (
            <span className="text-xl shrink-0">{personalWorkspaceIcono}</span>
          ) : (
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 100 100" fill="none">
                <g fill="white">
                  <rect x="25" y="45" width="10" height="30" rx="2"/>
                  <rect x="45" y="35" width="10" height="40" rx="2"/>
                  <rect x="65" y="25" width="10" height="50" rx="2"/>
                </g>
              </svg>
            </div>
          )}
          <div className="min-w-0 overflow-hidden">
            <span className="font-bold text-sm text-slate-900 block">FinControl</span>
            {currentWorkspace ? (
              <span className="text-[10px] text-primary font-medium truncate block">{currentWorkspace.name}</span>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium truncate block">{personalWorkspaceName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationsBell />
          <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0 border border-emerald-100">
            USD {formatMoney(dolar)}
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
      <aside
        className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-50
        transform transition-transform duration-200 ease-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        role="navigation"
        aria-label="Menú principal"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none">
                <g fill="white">
                  <rect x="25" y="45" width="10" height="30" rx="2"/>
                  <rect x="45" y="35" width="10" height="40" rx="2"/>
                  <rect x="65" y="25" width="10" height="50" rx="2"/>
                </g>
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">FinControl</div>
              <div className="text-xs text-slate-400 truncate max-w-[120px]">{profile?.nombre}</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg" aria-label="Cerrar menú">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="relative">
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className={`w-full border rounded-xl p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                (currentWorkspace && currentWorkspace.id !== profile?.personal_workspace_id) ? 'bg-primary-50/50 border-primary-200' : 'bg-slate-50 border-slate-200'
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
                      currentWorkspace.owner_id === user.uid ? 'bg-primary-500' : 'bg-purple-500'
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
                    // Buscar el workspace personal en la lista ya cargada (más robusto que llamar a ensurePersonalWorkspace)
                    const personalWs = workspaces.find(w => w.type === 'personal' && w.owner_id === user?.uid)
                      || workspaces.find(w => w.id === profile?.personal_workspace_id)

                    if (personalWs) {
                      setCurrentWorkspace(personalWs)
                    } else if (user) {
                      // Fallback: usar stub con datos del perfil
                      const stub: Workspace = {
                        id: profile?.personal_workspace_id || 'personal-stub',
                        name: personalWorkspaceName,
                        owner_id: user.uid,
                        type: 'personal',
                        icono: personalWorkspaceIcono,
                        logo: personalWorkspaceLogo,
                        ingresos_habilitado: profile?.ingresos_habilitado ?? false,
                        budget_ars: 0,
                        budget_usd: 0,
                        created_at: new Date().toISOString(),
                      }
                      setCurrentWorkspace(stub)
                    }
                    setWorkspaceDropdownOpen(false)
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
                {workspaces.filter(w => w.id !== profile?.personal_workspace_id).map((workspace) => {
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
                        ${currentWorkspace?.id === workspace.id ? (isOwner ? 'bg-primary-50' : 'bg-purple-50') : ''}
                      `}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                          workspace.logo || workspace.icono ? 'bg-transparent' : (isOwner ? 'bg-primary-500' : 'bg-purple-500')
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
                          <div className={`text-[10px] font-bold uppercase ${isOwner ? 'text-primary' : 'text-purple-600'}`}>
                            {isOwner ? 'Propietario' : 'Colaborador'}
                          </div>
                        </div>
                      </div>
                      {currentWorkspace?.id === workspace.id && (
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isOwner ? 'bg-primary-600' : 'bg-purple-600'}`} />
                      )}
                    </button>
                  )
                })}
                
                {workspaces.filter(w => w.id !== profile?.personal_workspace_id).length === 0 && (
                  <div className="px-4 py-3 text-xs text-center text-slate-400">
                    No tenés espacios colaborativos
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dolar Badge */}
        <div className="px-3 pt-3">
          <div className="bg-emerald-50/80 border border-emerald-100 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Dólar BNA</span>
            <span className="text-sm font-bold text-emerald-700">{formatMoney(dolar)}</span>
          </div>
        </div>

        {/* Month Navigator */}
        <div className="px-3 py-3">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex items-center justify-between">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="font-semibold text-sm text-slate-700">{getMonthName(currentMonth)}</span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-320px)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-primary text-white shadow-sm shadow-primary/25'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Desktop Header */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 items-center justify-end px-6 gap-3">
        <NotificationsBell />
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-semibold border border-emerald-100">
          USD {formatMoney(dolar)}
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
