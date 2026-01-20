'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { Notificacion } from '@/types'
import { collection, query, where, getDocs, updateDoc, doc, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

export function NotificationsBell() {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Validar que tenemos los datos necesarios antes de construir la query
    if (!user || !user.uid) return

    // Validar que currentWorkspace tenga id válido antes de usarlo
    const isWorkspaceMode = currentWorkspace !== null && 
                            currentWorkspace.id !== undefined && 
                            currentWorkspace.id !== null
    
    let q
    
    if (isWorkspaceMode && currentWorkspace?.id) {
      // En modo workspace: buscar notificaciones del workspace
      const notificacionesRef = collection(db, 'notificaciones')
      q = query(
        notificacionesRef,
        where('workspace_id', '==', currentWorkspace.id),
        orderBy('created_at', 'desc')
      )
    } else {
      // En modo personal: buscar notificaciones del usuario SIN workspace_id
      // (las notificaciones con workspace_id no deberían aparecer en modo personal)
      if (!user.uid) return
      const notificacionesRef = collection(db, 'notificaciones')
      q = query(
        notificacionesRef,
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
    }

    // Suscribirse a cambios en tiempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notificacion[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        notifs.push({
          id: doc.id,
          user_id: data.user_id,
          tipo: data.tipo,
          titulo: data.titulo,
          mensaje: data.mensaje,
          icono: data.icono,
          leida: data.leida || false,
          tarjeta_id: data.tarjeta_id || null,
          fecha_evento: data.fecha_evento?.toDate?.()?.toISOString() || data.fecha_evento || null,
          link: data.link || null,
          workspace_id: data.workspace_id || undefined, // Incluir workspace_id si existe
          created_at: data.created_at instanceof Timestamp 
            ? data.created_at.toDate().toISOString() 
            : data.created_at
        })
      })
      
      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.leida).length)
    }, (error) => {
      // Solo loggear errores que no sean de permisos (que se resuelven al cargar)
      if (error.code !== 'permission-denied') {
        console.error('Error escuchando notificaciones:', error)
      }
      // En caso de error, establecer arrays vacíos para evitar errores de renderizado
      setNotifications([])
      setUnreadCount(0)
    })

    return () => unsubscribe()
  }, [user, currentWorkspace])

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
      await updateDoc(doc(db, 'notificaciones', id), {
        leida: true
      })
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

  const getNotificationColor = (tipo: string) => {
    switch (tipo) {
      case 'cierre':
        return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'vencimiento':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'presupuesto':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800'
    }
  }

  if (!user) return null

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
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-lg">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Marcar todas como leídas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tenés notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 hover:bg-slate-50 transition-colors ${
                      !notif.leida ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">{notif.icono}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1">{notif.titulo}</h4>
                            <p className="text-xs text-slate-600 mb-2">{notif.mensaje}</p>
                            {notif.fecha_evento && (
                              <p className="text-xs text-slate-400">
                                {new Date(notif.fecha_evento).toLocaleDateString('es-AR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </p>
                            )}
                          </div>
                          {!notif.leida && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                              title="Marcar como leída"
                            >
                              <Check className="w-4 h-4 text-slate-400" />
                            </button>
                          )}
                        </div>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => {
                              if (!notif.leida) markAsRead(notif.id)
                              setIsOpen(false)
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2 inline-block"
                          >
                            Ver más →
                          </Link>
                        )}
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
