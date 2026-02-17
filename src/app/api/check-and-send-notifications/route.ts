import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import type { Tarjeta, Profile } from '@/types'

// Inicializar Firebase Admin SDK si no está inicializado
let adminInitialized = false

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) return true

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccount) {
      console.error('❌ [Cron] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      return false
    }

    let serviceAccountJson: any
    try {
      serviceAccountJson = JSON.parse(serviceAccount)
    } catch (parseError: any) {
      console.error('❌ [Cron] Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message)
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    })

    adminInitialized = true
    console.log('✅ [Cron] Firebase Admin SDK inicializado correctamente')
    return true
  } catch (error: any) {
    console.error('❌ [Cron] Error inicializando Firebase Admin SDK:', error.message)
    return false
  }
}

// Esta función se puede llamar desde un cron job o manualmente
export async function GET(request: NextRequest) {
  try {
    // Admin SDK (necesario para cron sin auth)
    if (!initializeAdmin()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no está configurado. Falta FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      )
    }

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

    // Usar timezone de Argentina (UTC-3) para calcular fechas
    const nowUtc = new Date()
    const argentinaOffset = -3 * 60 // UTC-3 en minutos
    const argentinaTime = new Date(nowUtc.getTime() + (argentinaOffset + nowUtc.getTimezoneOffset()) * 60 * 1000)
    
    const day = argentinaTime.getDate()
    const month = argentinaTime.getMonth()
    const year = argentinaTime.getFullYear()
    
    // Calcular fecha objetivo (2 días desde hoy en Argentina) - maneja correctamente cambio de mes
    const targetDate = new Date(year, month, day + 2)
    const targetDay = targetDate.getDate()
    
    console.log('🔔 [Cron] Hora UTC:', nowUtc.toISOString())
    console.log('🔔 [Cron] Hora Argentina:', `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(argentinaTime.getHours()).padStart(2, '0')}:${String(argentinaTime.getMinutes()).padStart(2, '0')}`)
    console.log('🔔 [Cron] Fecha objetivo (2 días en Argentina):', `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`)
    console.log('🔔 [Cron] Día objetivo:', targetDay)

    console.log('🔔 [Cron] Verificando notificaciones para día:', targetDay)

    // Obtener todas las tarjetas
    const firestore = admin.firestore()
    const tarjetasSnap = await firestore.collection('tarjetas').get()
    
    console.log(`🔔 [Cron] Total de tarjetas encontradas: ${tarjetasSnap.size}`)
    
    const notificationsToSend: Array<{
      tipo: 'cierre' | 'vencimiento' | 'recordatorio'
      userId: string
      tarjetaId: string
      tarjetaNombre: string
      dia: number
      fecha: string
      workspaceId?: string
      mensaje: string
      targetDate: Date
      channels?: { email: boolean; push: boolean }
    }> = []

    // Definir los días a verificar: 0 (Hoy), 1 (Mañana), 2 (Pasado mañana)
    const offsets = [0, 1, 2]

    tarjetasSnap.docs.forEach(doc => {
      const data = doc.data() as Tarjeta & { workspace_id?: string }
      
      // Log para debugging
      const hasCierre = data.notificar_cierre && data.cierre !== null && data.cierre !== undefined
      const hasVencimiento = data.notificar_vencimiento && data.vencimiento !== null && data.vencimiento !== undefined
      
      if (hasCierre || hasVencimiento) {
        console.log(`🔔 [Cron] Tarjeta ${data.nombre}: cierre=${data.cierre}, vencimiento=${data.vencimiento}, notificar_cierre=${data.notificar_cierre}, notificar_vencimiento=${data.notificar_vencimiento}, targetDay=${targetDay}`)
      }
      
      offsets.forEach(offset => {
        // Calcular fecha objetivo para este offset
        const targetDate = new Date(year, month, day + offset)
        const targetDay = targetDate.getDate()
        
        let timeText = ''
        if (offset === 0) timeText = 'hoy'
        else if (offset === 1) timeText = 'mañana'
        else timeText = `en ${offset} días`

        // Verificar cierre (si está habilitado y el día coincide)
        if (data.notificar_cierre && data.cierre === targetDay) {
          const fechaCierre = `${targetDay}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`
          notificationsToSend.push({
            tipo: 'cierre',
            userId: data.user_id,
            tarjetaId: doc.id,
            tarjetaNombre: data.nombre,
            dia: targetDay,
            fecha: fechaCierre,
            workspaceId: data.workspace_id,
            mensaje: `La tarjeta ${data.nombre} cierra ${timeText} (día ${targetDay})`,
            targetDate: targetDate
          })
          console.log(`✅ [Cron] Agregada notificación de cierre para ${data.nombre} (${timeText}, día ${targetDay})`)
        }

        // Verificar vencimiento (si está habilitado y el día coincide)
        if (data.notificar_vencimiento && data.vencimiento === targetDay) {
          const fechaVencimiento = `${targetDay}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`
          notificationsToSend.push({
            tipo: 'vencimiento',
            userId: data.user_id,
            tarjetaId: doc.id,
            tarjetaNombre: data.nombre,
            dia: targetDay,
            fecha: fechaVencimiento,
            workspaceId: data.workspace_id,
            mensaje: `El vencimiento de pago de ${data.nombre} es ${timeText} (día ${targetDay})`,
            targetDate: targetDate
          })
          console.log(`✅ [Cron] Agregada notificación de vencimiento para ${data.nombre} (${timeText}, día ${targetDay})`)
        }
      })
    })

    // --- NUEVO: Procesar Recordatorios Personalizados ---
    try {
      const recordatoriosSnap = await firestore.collection('recordatorios').get()
      console.log(`🔔 [Cron] Total de recordatorios personalizados encontrados: ${recordatoriosSnap.size}`)

      recordatoriosSnap.docs.forEach(doc => {
        const data = doc.data()
        if (!data.user_id || !data.fecha || !data.titulo) return

        // Parsear fecha del recordatorio
        let eventDate: Date
        if (data.fecha && typeof data.fecha.toDate === 'function') {
          eventDate = data.fecha.toDate()
        } else {
          // Asumir string YYYY-MM-DD
          const parts = String(data.fecha).split('-')
          if (parts.length === 3) {
            eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
          } else {
            eventDate = new Date(data.fecha)
          }
        }

        // Normalizar fechas a medianoche para comparar días exactos
        const today = new Date(year, month, day)
        const target = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
        
        const diffTime = target.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Verificar si coincide con la configuración de "días antes"
        // Soporta que 'dias_antes' sea un número (ej: 2) o un array (ej: [0, 1])
        let shouldNotify = false
        const diasAntes = data.dias_antes

        if (Array.isArray(diasAntes)) {
          shouldNotify = diasAntes.includes(diffDays)
        } else if (typeof diasAntes === 'number') {
          shouldNotify = diasAntes === diffDays
        } else if (typeof diasAntes === 'string') {
           shouldNotify = parseInt(diasAntes) === diffDays
        }

        if (shouldNotify) {
          let timeText = ''
          if (diffDays === 0) timeText = 'hoy'
          else if (diffDays === 1) timeText = 'mañana'
          else timeText = `en ${diffDays} días`

          notificationsToSend.push({
            tipo: 'recordatorio',
            userId: data.user_id,
            tarjetaId: doc.id,
            tarjetaNombre: data.titulo, // Usamos el título como nombre
            dia: target.getDate(),
            fecha: `${target.getDate()}/${target.getMonth() + 1}/${target.getFullYear()}`,
            workspaceId: data.workspace_id,
            mensaje: `${data.titulo} es ${timeText}`,
            targetDate: target,
            channels: {
              email: data.notificar_email === true,
              push: data.notificar_push === true
            }
          })
          console.log(`✅ [Cron] Agregado recordatorio personalizado: ${data.titulo} (${timeText})`)
        }
      })
    } catch (e) {
      console.error('❌ [Cron] Error procesando recordatorios:', e)
    }
    // ----------------------------------------------------

    console.log('🔔 [Cron] Notificaciones a enviar:', notificationsToSend.length)

    // Obtener perfiles de usuarios para enviar correos
    const profilesSnap = await firestore.collection('profiles').get()
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

    // Resolver base URL para llamadas internas. Usamos, en orden:
    // 1) NEXT_PUBLIC_APP_URL si está configurada (entorno deploy)
    // 2) BASE_URL/VERCEL_URL si existe
    // 3) El origin de la petición (si llega desde nuestro dominio)
    // Resolver base URL con fallback seguro (evitar localhost en producción)
    let baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      process.env.BASE_URL ||
      request.nextUrl.origin

    // Si quedó apuntando a localhost pero el host de la petición no es localhost, usar el origin
    const isLocalhost = baseUrl?.includes('localhost') || baseUrl?.includes('127.0.0.1')
    const requestHost = request.headers.get('host') || ''
    const requestIsLocal = requestHost.includes('localhost') || requestHost.includes('127.0.0.1')
    if (isLocalhost && !requestIsLocal) {
      console.warn('⚠️ [Cron] baseUrl apunta a localhost en entorno no-local, cambiando a request origin')
      baseUrl = request.nextUrl.origin
    }

    console.log('🔔 [Cron] baseUrl resuelto:', baseUrl)

    if (!baseUrl) {
      console.error('❌ [Cron] No se pudo resolver el baseUrl para las llamadas internas')
      return NextResponse.json(
        { error: 'No se pudo resolver el dominio para las llamadas internas' },
        { status: 500 }
      )
    }

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

      // Fallback: intentar obtener el usuario desde Firebase Auth si no hay perfil
      let profileEmail = profile?.email || null
      let profileName = profile?.nombre || null

      if (!profileEmail) {
        try {
          const authUser = await admin.auth().getUser(notif.userId)
          profileEmail = authUser.email || null
          profileName = profileName || authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : null)
        } catch (e) {
          console.warn('⚠️ [Cron] No se pudo obtener usuario de Auth para', notif.userId)
        }
      }

      // Si no tenemos email, continuamos sin enviar correo, pero sí campanita/push
      if (!profileEmail) {
        console.warn('⚠️ [Cron] Perfil sin email, se omite envío de correo. userId:', notif.userId, 'Tarjeta:', notif.tarjetaNombre)
      }

      try {
        // Llamar a la API de envío de correo
        // Enviar correo solo si tenemos email
        const shouldSendEmail = notif.channels ? notif.channels.email : true
        if (profileEmail && shouldSendEmail) {
          const emailUrl = `${baseUrl}/api/send-notification-email`
          try {
            const response = await fetch(emailUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tipo: notif.tipo,
                userName: profileName || profileEmail.split('@')[0],
                userEmail: profileEmail,
                tarjetaNombre: notif.tarjetaNombre,
                dia: notif.dia,
                fecha: notif.fecha
              })
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error('❌ [Cron] Error enviando notificación (email):', response.status, errorText)
            }
          } catch (emailError: any) {
            console.error('❌ [Cron] Fetch falló al enviar email:', emailUrl, emailError?.message)
          }
        }

        // Crear notificación en Firestore (campanita)
        const notificacionData: Record<string, any> = {
          user_id: notif.userId,
          tipo: notif.tipo,
          titulo: notif.tipo === 'cierre' 
            ? `Cierre de ${notif.tarjetaNombre}`
            : notif.tipo === 'vencimiento'
              ? `Vencimiento de pago ${notif.tarjetaNombre}`
              : `🔔 ${notif.tarjetaNombre}`,
          mensaje: notif.mensaje,
          icono: notif.tipo === 'cierre' ? '📅' : (notif.tipo === 'vencimiento' ? '💳' : '⏰'),
          leida: false,
          tarjeta_id: notif.tarjetaId,
          fecha_evento: admin.firestore.Timestamp.fromDate(notif.targetDate),
          link: notif.tipo === 'recordatorio' ? '/recordatorios' : '/dashboard',
          created_at: admin.firestore.Timestamp.now()
        }
        // Incluir workspace_id si existe (necesario para permisos)
        if (notif.workspaceId) {
          notificacionData.workspace_id = notif.workspaceId
        }
        await firestore.collection('notificaciones').add(notificacionData)

        // Enviar notificación push
        const shouldSendPush = notif.channels ? notif.channels.push : true
        if (shouldSendPush) {
          try {
          const pushUrl = `${baseUrl}/api/send-push-notification`
          const pushResponse = await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: notif.userId,
              title: notif.tipo === 'cierre' 
                ? `🔔 Cierre de ${notif.tarjetaNombre}`
                : notif.tipo === 'vencimiento'
                  ? `💳 Vencimiento de ${notif.tarjetaNombre}`
                  : `⏰ ${notif.tarjetaNombre}`,
              body: notif.mensaje,
              url: notif.tipo === 'recordatorio' ? '/recordatorios' : '/dashboard',
              tag: `${notif.tipo}-${notif.tarjetaId}`,
              workspaceId: notif.workspaceId
            })
          })

          if (pushResponse.ok) {
            const pushResult = await pushResponse.json()
            console.log(`✅ [Cron] Push notification enviada: ${pushResult.sent}/${pushResult.total}`)
          } else {
            console.warn('⚠️ [Cron] Error enviando push notification:', pushResponse.status, await pushResponse.text())
          }
        } catch (pushError: any) {
          console.warn('⚠️ [Cron] Excepción enviando push notification:', pushError?.message)
          // No fallar si el push falla (el correo y la campanita ya se enviaron)
        }
        }

        results.push({ success: true, notif })
      } catch (error: any) {
        console.error('❌ [Cron] Excepción enviando notificación:', error)
        results.push({ success: false, notif, error: error.message })
      }
    }

    // También verificar ingresos pendientes
    let ingresosPendientesChecked = 0
    let ingresosPendientesSent = 0
    try {
      // Usar el mismo baseUrl que se resolvió arriba
      const ingresosUrl = `${baseUrl}/api/check-pending-income-notifications`
      console.log('🔔 [Cron] Llamando a ingresos pendientes:', ingresosUrl)
      console.log('🔔 [Cron] baseUrl usado:', baseUrl)
      
      // Agregar timeout para evitar que se cuelgue
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos timeout
      
      try {
        const ingresosResponse = await fetch(ingresosUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (ingresosResponse.ok) {
          const ingresosData = await ingresosResponse.json()
          ingresosPendientesChecked = ingresosData.checked || 0
          ingresosPendientesSent = ingresosData.sent || 0
          console.log(`✅ [Cron] Ingresos pendientes procesados: ${ingresosPendientesChecked} verificados, ${ingresosPendientesSent} notificaciones enviadas`)
        } else {
          const errorText = await ingresosResponse.text()
          console.error(`❌ [Cron] Error en respuesta de ingresos pendientes: ${ingresosResponse.status} - ${errorText}`)
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          console.error('❌ [Cron] Timeout al verificar ingresos pendientes (30s)')
        } else {
          throw fetchError
        }
      }
    } catch (ingresosError: any) {
      console.error('❌ [Cron] Error verificando ingresos pendientes:', ingresosError?.message)
      console.error('❌ [Cron] Tipo de error:', ingresosError?.name)
      console.error('❌ [Cron] Stack:', ingresosError?.stack)
      // No fallar todo el proceso si esto falla
    }

    return NextResponse.json({
      success: true,
      processed: notificationsToSend.length,
      results,
      ingresosPendientes: {
        checked: ingresosPendientesChecked,
        sent: ingresosPendientesSent
      },
      message: `Procesadas ${notificationsToSend.length} notificaciones de tarjetas y ${ingresosPendientesChecked} ingresos pendientes (${ingresosPendientesSent} notificaciones enviadas)`
    })
  } catch (error: any) {
    console.error('❌ [Cron] Error en check-and-send-notifications:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
