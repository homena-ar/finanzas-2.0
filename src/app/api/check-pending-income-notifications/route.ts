import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// Inicializar Firebase Admin SDK si no está inicializado
let adminInitialized = false

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) return true

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccount) {
      console.error('❌ [Ingresos Pendientes] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      return false
    }

    let serviceAccountJson: any
    try {
      serviceAccountJson = JSON.parse(serviceAccount)
    } catch (parseError: any) {
      console.error('❌ [Ingresos Pendientes] Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message)
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    })

    adminInitialized = true
    console.log('✅ [Ingresos Pendientes] Firebase Admin SDK inicializado correctamente')
    return true
  } catch (error: any) {
    console.error('❌ [Ingresos Pendientes] Error inicializando Firebase Admin SDK:', error.message)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no configurado' },
        { status: 500 }
      )
    }

    const firestore = admin.firestore()
    
    // Usar timezone de Argentina (UTC-3) para calcular fechas
    const nowUtc = new Date()
    const argentinaOffset = -3 * 60 // UTC-3 en minutos
    const argentinaTime = new Date(nowUtc.getTime() + (argentinaOffset + nowUtc.getTimezoneOffset()) * 60 * 1000)
    
    const todayArgentina = new Date(argentinaTime.getFullYear(), argentinaTime.getMonth(), argentinaTime.getDate())
    
    // Calcular fecha objetivo (1 día desde hoy en Argentina) - maneja correctamente cambio de mes
    const targetDate = new Date(todayArgentina)
    targetDate.setDate(targetDate.getDate() + 1)
    const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`

    console.log('📧 [Ingresos Pendientes] Hora UTC:', nowUtc.toISOString())
    console.log('📧 [Ingresos Pendientes] Hora Argentina:', `${todayArgentina.getFullYear()}-${String(todayArgentina.getMonth() + 1).padStart(2, '0')}-${String(todayArgentina.getDate()).padStart(2, '0')}`)
    console.log('📧 [Ingresos Pendientes] Fecha objetivo (mañana en Argentina):', targetDateStr)

    // Primero, buscar TODOS los ingresos pendientes para diagnóstico
    const allPendingQuery = firestore
      .collection('ingresos')
      .where('pendiente_cobro', '==', true)
    
    const allPendingSnap = await allPendingQuery.get()
    console.log(`📧 [Ingresos Pendientes] Total ingresos pendientes de cobro: ${allPendingSnap.size}`)
    
    // Mostrar detalles de cada uno para diagnóstico
    allPendingSnap.docs.forEach(doc => {
      const data = doc.data()
      console.log(`📧 [Ingresos Pendientes] - ${data.descripcion}: fecha_cobro_esperada=${data.fecha_cobro_esperada}, fecha_cobro_confirmada=${data.fecha_cobro_confirmada}, notificar_correo=${data.notificar_correo}`)
    })

    // Filtrar manualmente los que coinciden con la fecha objetivo y no están confirmados
    const ingresosPendientes = allPendingSnap.docs.filter(doc => {
      const data = doc.data()
      const fechaCoincide = data.fecha_cobro_esperada === targetDateStr
      const noConfirmado = !data.fecha_cobro_confirmada || data.fecha_cobro_confirmada === null || data.fecha_cobro_confirmada === ''
      
      if (fechaCoincide) {
        console.log(`📧 [Ingresos Pendientes] Fecha coincide para "${data.descripcion}": esperada=${data.fecha_cobro_esperada}, target=${targetDateStr}, confirmada=${data.fecha_cobro_confirmada}, noConfirmado=${noConfirmado}`)
      }
      
      return fechaCoincide && noConfirmado
    })

    if (ingresosPendientes.length === 0) {
      console.log('📧 [Ingresos Pendientes] No hay ingresos pendientes para mañana (1 día antes)')
      return NextResponse.json({
        success: true,
        checked: 0,
        sent: 0,
        message: 'No hay ingresos pendientes para mañana (1 día antes)',
        debug: {
          totalPendientes: allPendingSnap.size,
          fechaBuscada: targetDateStr
        }
      })
    }

    // Usar el array filtrado en lugar del snapshot original
    const ingresosSnap = { docs: ingresosPendientes, size: ingresosPendientes.length }

    console.log(`📧 [Ingresos Pendientes] Encontrados ${ingresosSnap.size} ingresos pendientes para mañana (1 día antes)`)

    // Resolver base URL con la misma lógica que check-and-send-notifications
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
      console.warn('⚠️ [Ingresos Pendientes] baseUrl apunta a localhost en entorno no-local, cambiando a request origin')
      baseUrl = request.nextUrl.origin
    }

    if (!baseUrl) {
      console.error('❌ [Ingresos Pendientes] No se pudo resolver el baseUrl para las llamadas internas')
      baseUrl = 'http://localhost:3000' // Fallback
    }

    console.log('📧 [Ingresos Pendientes] baseUrl resuelto:', baseUrl)

    let sentCount = 0
    const errors: string[] = []

    for (const ingresoDoc of ingresosSnap.docs) {
      const ingreso = ingresoDoc.data()
      const ingresoId = ingresoDoc.id

      try {
        // Obtener información del usuario - primero intentar en profiles
        let profileEmail: string | null = null
        let profileName: string | null = null
        
        // Intentar obtener de profiles
        const profileDoc = await firestore.collection('profiles').doc(ingreso.user_id).get()
        if (profileDoc.exists) {
          const profileData = profileDoc.data()
          profileEmail = profileData?.email || null
          profileName = profileData?.nombre || profileData?.display_name || null
          console.log(`📧 [Ingresos Pendientes] Perfil encontrado para ${ingreso.user_id}: ${profileEmail}`)
        }
        
        // Si no hay email en profile, intentar con Firebase Auth
        if (!profileEmail) {
          try {
            const authUser = await admin.auth().getUser(ingreso.user_id)
            profileEmail = authUser.email || null
            profileName = profileName || authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : null)
            console.log(`📧 [Ingresos Pendientes] Email obtenido de Auth para ${ingreso.user_id}: ${profileEmail}`)
          } catch (authError: any) {
            console.warn(`⚠️ [Ingresos Pendientes] No se pudo obtener usuario de Auth: ${ingreso.user_id}`, authError?.message)
          }
        }
        
        if (!profileEmail) {
          console.warn(`⚠️ [Ingresos Pendientes] No se encontró email para usuario: ${ingreso.user_id}`)
          continue
        }
        
        // Nombre por defecto si no se encontró
        if (!profileName) {
          profileName = profileEmail.split('@')[0]
        }

        // Verificar si debe notificar
        const notificarCorreo = ingreso.notificar_correo !== false // Por defecto true

        if (!notificarCorreo) {
          console.log(`⏭️ [Ingresos Pendientes] Notificaciones deshabilitadas para ingreso ${ingresoId}`)
          continue
        }

        const montoFormateado = new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: ingreso.moneda || 'ARS',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(ingreso.monto)

        // Enviar correo si está habilitado
        if (notificarCorreo && profileEmail) {
          try {
            const emailUrl = `${baseUrl}/api/send-pending-income-email`
            const emailResponse = await fetch(emailUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userName: profileName,
                userEmail: profileEmail,
                ingresoDescripcion: ingreso.descripcion,
                ingresoMonto: montoFormateado,
                ingresoMoneda: ingreso.moneda || 'ARS',
                fechaCobroEsperada: ingreso.fecha_cobro_esperada
              })
            })

            if (emailResponse.ok) {
              console.log(`✅ [Ingresos Pendientes] Email enviado para ingreso ${ingresoId}`)
              sentCount++
            } else {
              const errorText = await emailResponse.text()
              console.error(`❌ [Ingresos Pendientes] Error enviando email para ingreso ${ingresoId}:`, errorText)
              errors.push(`Email para ${ingresoId}: ${errorText}`)
            }
          } catch (emailError: any) {
            console.error(`❌ [Ingresos Pendientes] Error en fetch de email para ingreso ${ingresoId}:`, emailError?.message)
            errors.push(`Email para ${ingresoId}: ${emailError?.message}`)
          }
        }

        // Enviar notificación push si el usuario tiene la app instalada (automático, no requiere configuración)
        try {
          const pushUrl = `${baseUrl}/api/send-push-notification`
          const pushResponse = await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: ingreso.user_id,
              title: '💰 Recordatorio: Cobro pendiente',
              body: `${ingreso.descripcion} - ${montoFormateado}`,
              url: '/dashboard/ingresos',
              tag: 'ingreso-pendiente',
              workspaceId: ingreso.workspace_id || null
            })
          })

          if (pushResponse.ok) {
            const pushResult = await pushResponse.json()
            console.log(`✅ [Ingresos Pendientes] Push enviado para ingreso ${ingresoId}: ${pushResult.sent}/${pushResult.total}`)
          } else {
            // No es un error crítico si no hay tokens registrados
            console.log(`ℹ️ [Ingresos Pendientes] No se pudo enviar push para ingreso ${ingresoId} (puede que el usuario no tenga la app instalada)`)
          }
        } catch (pushError: any) {
          // No es un error crítico si falla el push
          console.log(`ℹ️ [Ingresos Pendientes] Error en push para ingreso ${ingresoId}:`, pushError?.message)
        }

        // Crear notificación en Firestore (campanita)
        try {
          const notificacionData: Record<string, any> = {
            user_id: ingreso.user_id,
            tipo: 'sistema',
            titulo: '💰 Recordatorio: Cobro pendiente',
            mensaje: `${ingreso.descripcion} - ${montoFormateado}`,
            icono: '💰',
            leida: false,
            link: '/dashboard/ingresos',
            created_at: admin.firestore.Timestamp.now()
          }

          if (ingreso.workspace_id) {
            notificacionData.workspace_id = ingreso.workspace_id
          }

          await firestore.collection('notificaciones').add(notificacionData)
          console.log(`✅ [Ingresos Pendientes] Notificación creada en Firestore para ingreso ${ingresoId}`)
        } catch (notifError: any) {
          console.error(`❌ [Ingresos Pendientes] Error creando notificación en Firestore:`, notifError?.message)
        }

      } catch (error: any) {
        console.error(`❌ [Ingresos Pendientes] Error procesando ingreso ${ingresoId}:`, error?.message)
        errors.push(`Ingreso ${ingresoId}: ${error?.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      checked: ingresosSnap.size,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Procesados ${ingresosSnap.size} ingresos pendientes, ${sentCount} notificaciones enviadas`
    })

  } catch (error: any) {
    console.error('❌ [Ingresos Pendientes] Error general:', error)
    return NextResponse.json(
      {
        error: 'Error verificando ingresos pendientes',
        details: error.message
      },
      { status: 500 }
    )
  }
}
