import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Tarjeta, Profile } from '@/types'

// Esta función se puede llamar desde un cron job o manualmente
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    // Aceptar tanto CRON_SECRET como CRON_SECRET_KEY para compatibilidad
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
    
    // Validar que existe la clave secreta
    if (!cronSecret || cronSecret === 'your-secret-key') {
      console.error('❌ [Cron] CRON_SECRET no está configurada correctamente')
      return NextResponse.json(
        { error: 'Configuración de seguridad no válida' },
        { status: 500 }
      )
    }
    
    // Verificar que la llamada viene de un cron job autorizado
    if (!authHeader) {
      console.warn('⚠️ [Cron] Intento de acceso sin autorización')
      return NextResponse.json(
        { error: 'No autorizado - Falta header de autorización' },
        { status: 401 }
      )
    }

    const expectedAuth = `Bearer ${cronSecret}`
    if (authHeader !== expectedAuth) {
      console.warn('⚠️ [Cron] Intento de acceso con clave inválida')
      return NextResponse.json(
        { error: 'No autorizado - Clave inválida' },
        { status: 401 }
      )
    }

    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth()
    const year = today.getFullYear()
    
    // Calcular fecha objetivo (2 días desde hoy) - maneja correctamente cambio de mes
    const targetDate = new Date(year, month, day + 2)
    const targetDay = targetDate.getDate()
    
    console.log('🔔 [Cron] Fecha actual:', today.toISOString())
    console.log('🔔 [Cron] Fecha objetivo (2 días):', targetDate.toISOString())
    console.log('🔔 [Cron] Día objetivo:', targetDay)

    console.log('🔔 [Cron] Verificando notificaciones para día:', targetDay)

    // Obtener todas las tarjetas
    const tarjetasRef = collection(db, 'tarjetas')
    const tarjetasSnap = await getDocs(tarjetasRef)
    
    const notificationsToSend: Array<{
      tipo: 'cierre' | 'vencimiento'
      userId: string
      tarjetaId: string
      tarjetaNombre: string
      dia: number
      fecha: string
    }> = []

    tarjetasSnap.docs.forEach(doc => {
      const data = doc.data() as Tarjeta
      
      // Verificar cierre (si está habilitado y el día coincide)
      if (data.notificar_cierre && data.cierre === targetDay) {
        const fechaCierre = `${targetDay}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`
        notificationsToSend.push({
          tipo: 'cierre',
          userId: data.user_id,
          tarjetaId: doc.id,
          tarjetaNombre: data.nombre,
          dia: data.cierre!,
          fecha: fechaCierre
        })
      }

      // Verificar vencimiento (si está habilitado y el día coincide)
      if (data.notificar_vencimiento && data.vencimiento === targetDay) {
        const fechaVencimiento = `${targetDay}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`
        notificationsToSend.push({
          tipo: 'vencimiento',
          userId: data.user_id,
          tarjetaId: doc.id,
          tarjetaNombre: data.nombre,
          dia: data.vencimiento!,
          fecha: fechaVencimiento
        })
      }
    })

    console.log('🔔 [Cron] Notificaciones a enviar:', notificationsToSend.length)

    // Obtener perfiles de usuarios para enviar correos
    const profilesRef = collection(db, 'profiles')
    const profilesSnap = await getDocs(profilesRef)
    const profilesMap = new Map<string, Profile>()
    
    profilesSnap.docs.forEach(doc => {
      const data = doc.data() as Profile
      // Mapear por user_id (que corresponde al auth.uid) y también por doc.id por si acaso
      const userId = data.id || doc.id
      profilesMap.set(userId, { ...data, id: userId })
      // También mapear por doc.id para compatibilidad
      if (doc.id !== userId) {
        profilesMap.set(doc.id, { ...data, id: userId })
      }
    })
    
    console.log('🔔 [Cron] Perfiles cargados:', profilesMap.size)

    // Enviar notificaciones
    const results = []
    for (const notif of notificationsToSend) {
      // Intentar obtener el perfil por user_id
      let profile = profilesMap.get(notif.userId)
      
      // Si no se encuentra, buscar en todos los perfiles por user_id
      if (!profile) {
        profilesMap.forEach((prof, key) => {
          if (!profile && (prof.id === notif.userId || key === notif.userId)) {
            profile = prof
          }
        })
      }
      
      if (!profile || !profile.email) {
        console.warn('⚠️ [Cron] Perfil no encontrado para usuario:', notif.userId, 'Tarjeta:', notif.tarjetaNombre)
        results.push({ success: false, notif, error: 'Perfil no encontrado' })
        continue
      }

      try {
        // Llamar a la API de envío de correo
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: notif.tipo,
            userName: profile.nombre,
            userEmail: profile.email,
            tarjetaNombre: notif.tarjetaNombre,
            dia: notif.dia,
            fecha: notif.fecha
          })
        })

        if (response.ok) {
          // Crear notificación en Firestore
          const notificacionesRef = collection(db, 'notificaciones')
          const { addDoc } = await import('firebase/firestore')
          await addDoc(notificacionesRef, {
            user_id: notif.userId,
            tipo: notif.tipo,
            titulo: notif.tipo === 'cierre' 
              ? `Cierre de ${notif.tarjetaNombre}`
              : `Vencimiento de pago ${notif.tarjetaNombre}`,
            mensaje: notif.tipo === 'cierre'
              ? `La tarjeta ${notif.tarjetaNombre} cierra en 2 días (día ${notif.dia})`
              : `El vencimiento de pago de ${notif.tarjetaNombre} es en 2 días (día ${notif.dia})`,
            icono: notif.tipo === 'cierre' ? '📅' : '💳',
            leida: false,
            tarjeta_id: notif.tarjetaId,
            fecha_evento: Timestamp.fromDate(targetDate),
            link: '/dashboard',
            created_at: Timestamp.now()
          })

          results.push({ success: true, notif })
        } else {
          const error = await response.json()
          console.error('❌ [Cron] Error enviando notificación:', error)
          results.push({ success: false, notif, error })
        }
      } catch (error: any) {
        console.error('❌ [Cron] Excepción enviando notificación:', error)
        results.push({ success: false, notif, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: notificationsToSend.length,
      results,
      message: `Procesadas ${notificationsToSend.length} notificaciones`
    })
  } catch (error: any) {
    console.error('❌ [Cron] Error en check-and-send-notifications:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
