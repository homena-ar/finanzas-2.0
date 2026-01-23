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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Calcular fecha objetivo (1 día desde hoy) - maneja correctamente cambio de mes
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + 1)
    const targetDateStr = targetDate.toISOString().split('T')[0]

    console.log('📧 [Ingresos Pendientes] Verificando ingresos pendientes para mañana (1 día antes):', targetDateStr)

    // Buscar todos los ingresos pendientes con fecha_cobro_esperada = mañana (1 día antes)
    const ingresosQuery = firestore
      .collection('ingresos')
      .where('pendiente_cobro', '==', true)
      .where('fecha_cobro_esperada', '==', targetDateStr)
      .where('fecha_cobro_confirmada', '==', null)

    const ingresosSnap = await ingresosQuery.get()

    if (ingresosSnap.empty) {
      console.log('📧 [Ingresos Pendientes] No hay ingresos pendientes para mañana (1 día antes)')
      return NextResponse.json({
        success: true,
        checked: 0,
        sent: 0,
        message: 'No hay ingresos pendientes para mañana (1 día antes)'
      })
    }

    console.log(`📧 [Ingresos Pendientes] Encontrados ${ingresosSnap.size} ingresos pendientes para mañana (1 día antes)`)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'

    let sentCount = 0
    const errors: string[] = []

    for (const ingresoDoc of ingresosSnap.docs) {
      const ingreso = ingresoDoc.data()
      const ingresoId = ingresoDoc.id

      try {
        // Obtener información del usuario
        const userDoc = await firestore.collection('users').doc(ingreso.user_id).get()
        if (!userDoc.exists) {
          console.warn(`⚠️ [Ingresos Pendientes] Usuario no encontrado: ${ingreso.user_id}`)
          continue
        }

        const userData = userDoc.data()
        const profileEmail = userData?.email || userData?.user_email
        const profileName = userData?.display_name || userData?.name || profileEmail?.split('@')[0] || 'Usuario'

        // Verificar si debe notificar
        const notificarCorreo = ingreso.notificar_correo !== false // Por defecto true

        if (!notificarCorreo) {
          console.log(`⏭️ [Ingresos Pendientes] Notificaciones deshabilitadas para ingreso ${ingresoId}`)
          continue
        }

        const montoFormateado = new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: ingreso.moneda || 'ARS',
          minimumFractionDigits: 2
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
              title: '💰 Recordatorio: Ingreso pendiente de cobro',
              body: `${ingreso.descripcion} - ${montoFormateado}. ¿Ya cobraste este ingreso?`,
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
            titulo: '💰 Ingreso pendiente de cobro',
            mensaje: `${ingreso.descripcion} - ${montoFormateado}. ¿Ya cobraste este ingreso?`,
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
