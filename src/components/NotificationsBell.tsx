'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Trash2 } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { Notificacion } from '@/types'
import { collection, query, where, updateDoc, deleteDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function NotificationsBell() {
  const { user } = useAuth()
  const { currentWorkspace, members } = useWorkspace()
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Determinar si el usuario es dueño o admin del workspace actual
  const isOwnerOrAdmin = (() => {
    if (!currentWorkspace || !user) return false
    // El dueño siempre tiene acceso
    if (currentWorkspace.owner_id === user.uid) return true
    // Buscar si el miembro tiene rol admin
    const member = members.find(m => m.workspace_id === currentWorkspace.id && m.user_id === user.uid)
    if (member && member.permissions) {
      // Admin si tiene al menos un permiso de admin
      const perms = member.permissions as unknown as Record<string, string>
      return Object.values(perms).some(p => p === 'admin')
    }
    return false
  })()

  useEffect(() => {
    if (!user || !user.uid) return

    const isWorkspaceMode = currentWorkspace !== null &&
                            currentWorkspace.id !== undefined &&
                            currentWorkspace.id !== null

    // En modo workspace, solo mostrar notificaciones a owners/admins
    if (isWorkspaceMode && !isOwnerOrAdmin) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let q
    const notificacionesRef = collection(db, 'notificaciones')

    if (isWorkspaceMode && currentWorkspace?.id) {
      q = query(
        notificacionesRef,
        where('workspace_id', '==', currentWorkspace.id)
      )
    } else {
      q = query(
        notificacionesRef,
        where('user_id', '==', user.uid)
      )
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notificacion[] = []
      snapshot.forEach((d) => {
        const data = d.data()
        notifs.push({
          id: d.id,
          user_id: data.user_id,
          tipo: data.tipo,
          titulo: data.titulo,
          mensaje: data.mensaje,
          icono: data.icono,
          leida: data.leida || false,
          tarjeta_id: data.tarjeta_id || null,
          fecha_evento: data.fecha_evento?.toDate?.()?.toISOString() || data.fecha_evento || null,
          link: data.link || null,
          workspace_id: data.workspace_id || undefined,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        })
      })

      // Ordenar por fecha más reciente primero
      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.leida).length)
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Error escuchando notificaciones:', error)
      }
      setNotifications([])
      setUnreadCount(0)
    })

    return () => unsubscribe()
  }, [user, currentWorkspace, isOwnerOrAdmin])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notificaciones', id), { leida: true })
    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.leida)
      await Promise.all(
        unread.map(n => updateDoc(doc(db, 'notificaciones', n.id), { leida: true }))
      )
    } catch (error) {
      console.error('Error marcando todas como leídas:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notificaciones', id))
    } catch (error) {
      console.error('Error eliminando notificación:', error)
    }
  }

  const deleteAllRead = async () => {
    try {
      const read = notifications.filter(n => n.leida)
      await Promise.all(
        read.map(n => deleteDoc(doc(db, 'notificaciones', n.id)))
      )
    } catch (error) {
      console.error('Error eliminando notificaciones leídas:', error)
    }
  }

  if (!user) return null

  // En modo workspace, ocultar la campana para colaboradores
  const isWorkspaceMode = currentWorkspace !== null &&
                          currentWorkspace.id !== undefined &&
                          currentWorkspace.id !== null
  if (isWorkspaceMode && !isOwnerOrAdmin) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                >
                  Leer todas
                </button>
              )}
              {notifications.some(n => n.leida) && (
                <button
                  onClick={deleteAllRead}
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  title="Eliminar leídas"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tenés notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 hover:bg-slate-50/50 transition-colors group ${
                      !notif.leida ? 'bg-primary-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="text-lg flex-shrink-0 mt-0.5">{notif.icono}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm leading-tight">{notif.titulo}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.mensaje}</p>
                            {notif.fecha_evento && (
                              <p className="text-[11px] text-slate-400 mt-1">
                                {new Date(notif.fecha_evento).toLocaleDateString('es-AR', {
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {!notif.leida && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Marcar como leída"
                              >
                                <Check className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
