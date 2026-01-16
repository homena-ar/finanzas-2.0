import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, type, mimeType } = body // type: 'gasto' | 'ingreso' | 'resumen'

    console.log('📄 [API] Procesando archivo - type:', type, 'mimeType:', mimeType)

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    // Determinar si es PDF o imagen
    const isPDF = mimeType === 'application/pdf' || imageBase64.includes('data:application/pdf')
    const isImage = imageBase64.includes('data:image/') || (!isPDF && mimeType?.startsWith('image/'))
    
    console.log('📄 [API] Tipo detectado - isPDF:', isPDF, 'isImage:', isImage)

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      console.error('❌ [API] GOOGLE_GEMINI_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración de IA no disponible. Por favor, configura GOOGLE_GEMINI_API_KEY en las variables de entorno.' },
        { status: 500 }
      )
    }

    // Inicializar Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Determinar el prompt según el tipo
    let prompt = ''
    const documentType = isPDF ? 'documento PDF' : 'imagen'
    
    // Detectar si es un resumen con múltiples transacciones (PDF de resumen bancario/tarjeta)
    const isResumenMultiple = (type === 'resumen' || (type === 'ingreso' && isPDF)) || (type === 'gasto' && isPDF)
    
    if (type === 'gasto' || type === 'comprobante') {
      if (isResumenMultiple) {
        // Para resúmenes de tarjeta o resúmenes con múltiples consumos
        prompt = `Analiza este ${documentType} que es un resumen de tarjeta de crédito o resumen bancario con múltiples transacciones. 

IMPORTANTE: Extrae CADA TRANSACCIÓN INDIVIDUAL, no solo el total. Busca cada consumo, pago o movimiento individual listado en el documento.

Responde en formato JSON con un array "transacciones" que contenga cada transacción individual encontrada:

{
  "transacciones": [
    {
      "descripcion": "descripción de la transacción individual (ej: nombre del comercio, descripción del consumo)",
      "monto": número (solo el número, sin símbolos, sin puntos de miles),
      "moneda": "ARS" o "USD",
      "fecha": "YYYY-MM-DD" (fecha de la transacción individual, si no está visible usa la fecha del resumen),
      "categoria": "categoría sugerida según la descripción (ej: Comida, Transporte, Supermercado, etc.)",
      "comercio": "nombre del comercio o establecimiento si está disponible"
    }
  ],
  "total": {
    "monto": número (total del resumen si está visible),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen"
  }
}

Si encuentras múltiples transacciones, inclúyelas todas en el array. NO incluyas solo el total. El monto debe ser solo el número sin símbolos de moneda ni puntos de miles. Las fechas deben estar en formato YYYY-MM-DD.`
      } else {
        // Para comprobantes individuales (tickets, facturas)
        prompt = `Analiza este ${documentType} de un comprobante de compra, ticket o factura y extrae la siguiente información en formato JSON:

{
  "descripcion": "descripción del producto o servicio comprado",
  "monto": número (solo el número, sin símbolos),
  "moneda": "ARS" o "USD",
  "fecha": "YYYY-MM-DD" (fecha de la compra, si no está visible usa la fecha actual),
  "categoria": "categoría sugerida (ej: Comida, Transporte, Hogar, etc.)",
  "comercio": "nombre del comercio o establecimiento"
}

Si no puedes identificar algún campo, usa null. Asegúrate de que el monto sea solo el número sin símbolos de moneda ni puntos de miles. La fecha debe estar en formato YYYY-MM-DD.`
      }
    } else if (type === 'ingreso' || type === 'resumen') {
      if (isResumenMultiple) {
        // Para resúmenes bancarios con múltiples ingresos
        prompt = `Analiza este ${documentType} que es un resumen bancario, extracto o resumen con múltiples transacciones de ingresos.

IMPORTANTE: Extrae CADA INGRESO INDIVIDUAL, no solo el total. Busca cada transferencia, depósito o ingreso individual listado en el documento.

Responde en formato JSON con un array "transacciones" que contenga cada ingreso individual encontrado:

{
  "transacciones": [
    {
      "descripcion": "descripción del ingreso individual (ej: Salario, Transferencia, Depósito, etc.)",
      "monto": número (solo el número, sin símbolos, sin puntos de miles),
      "moneda": "ARS" o "USD",
      "fecha": "YYYY-MM-DD" (fecha del ingreso individual, si no está visible usa la fecha del resumen),
      "categoria": "categoría sugerida según la descripción (ej: Salario, Freelance, Inversiones, etc.)",
      "origen": "origen del ingreso (banco, empresa, persona, etc.)"
    }
  ],
  "total": {
    "monto": número (total del resumen si está visible),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen"
  }
}

Si encuentras múltiples ingresos, inclúyelos todos en el array. NO incluyas solo el total. El monto debe ser solo el número sin símbolos de moneda ni puntos de miles. Las fechas deben estar en formato YYYY-MM-DD.`
      } else {
        // Para comprobantes individuales de ingreso
        prompt = `Analiza este ${documentType} de un comprobante de ingreso individual y extrae la siguiente información en formato JSON:

{
  "descripcion": "descripción del ingreso (ej: Salario, Transferencia, Depósito, etc.)",
  "monto": número (solo el número, sin símbolos),
  "moneda": "ARS" o "USD",
  "fecha": "YYYY-MM-DD" (fecha del ingreso, si no está visible usa la fecha actual),
  "categoria": "categoría sugerida (ej: Salario, Freelance, Inversiones, etc.)",
  "origen": "origen del ingreso (banco, empresa, etc.)"
}

Si no puedes identificar algún campo, usa null. Asegúrate de que el monto sea solo el número sin símbolos de moneda ni puntos de miles. La fecha debe estar en formato YYYY-MM-DD.`
      }
    } else {
      prompt = `Analiza esta imagen financiera y extrae información relevante en formato JSON. Identifica si es un gasto o ingreso y extrae:
- descripcion
- monto (número sin símbolos)
- moneda (ARS o USD)
- fecha (YYYY-MM-DD)
- categoria sugerida

Responde solo con el JSON, sin texto adicional.`
    }

    // Convertir base64 a formato que Gemini entienda
    let fileData: string
    let detectedMimeType: string

    if (isPDF) {
      // Para PDFs - extraer solo el base64 sin el prefijo data URL
      fileData = imageBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:application\/pdf,/, '')
      detectedMimeType = 'application/pdf'
      
      // Calcular tamaño aproximado del archivo (base64 es ~33% más grande que el original)
      const approxFileSizeMB = (fileData.length * 3) / 4 / 1024 / 1024
      console.log('📄 [API] PDF detectado - tamaño base64:', fileData.length, 'chars (~', approxFileSizeMB.toFixed(2), 'MB)')
      
      // Validar que el base64 sea válido
      if (!fileData || fileData.length === 0) {
        throw new Error('El PDF está vacío o no se pudo extraer el contenido base64')
      }
      
      // Gemini tiene un límite de ~20MB para archivos
      if (approxFileSizeMB > 20) {
        throw new Error(`El PDF es demasiado grande (${approxFileSizeMB.toFixed(2)} MB). El límite es 20 MB. Intenta comprimir el PDF o dividirlo en páginas.`)
      }
      
      if (approxFileSizeMB > 10) {
        console.warn('⚠️ [API] PDF grande detectado - puede tardar más en procesarse')
      }
    } else {
      // Para imágenes
      const imageMatch = imageBase64.match(/data:image\/(\w+);base64,/)
      fileData = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      detectedMimeType = imageMatch ? `image/${imageMatch[1]}` : 'image/jpeg'
      console.log('🖼️ [API] Imagen detectada - mimeType:', detectedMimeType)
    }

    // Usar el mimeType proporcionado o el detectado
    const finalMimeType = mimeType || detectedMimeType
    console.log('📄 [API] MimeType final:', finalMimeType)

    const filePart = {
      inlineData: {
        data: fileData,
        mimeType: finalMimeType
      }
    }

    console.log('📄 [API] Enviando a Gemini...')
    // Llamar a Gemini
    const result = await model.generateContent([prompt, filePart])
    const response = await result.response
    const text = response.text()
    console.log('📄 [API] Respuesta de Gemini recibida - longitud:', text.length)

    // Intentar extraer JSON de la respuesta
    let extractedData
    try {
      // Buscar JSON en la respuesta (puede venir con markdown o texto adicional)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
      } else {
        // Si no hay JSON, intentar parsear toda la respuesta
        extractedData = JSON.parse(text)
      }
    } catch (parseError: any) {
      console.error('❌ [API] Error parsing Gemini response:', parseError)
      console.error('❌ [API] Response text (primeros 500 chars):', text.substring(0, 500))
      return NextResponse.json(
        { 
          error: 'No se pudo extraer información estructurada del documento',
          details: parseError.message || 'Error al parsear la respuesta de la IA',
          rawResponse: text.substring(0, 1000) // Solo primeros 1000 caracteres para no exceder límites
        },
        { status: 500 }
      )
    }

    // Si la respuesta contiene un array de transacciones (resumen múltiple)
    if (extractedData.transacciones && Array.isArray(extractedData.transacciones)) {
      console.log('📄 [API] Resumen múltiple detectado - transacciones:', extractedData.transacciones.length)
      
      // Procesar cada transacción individual
      const cleanedTransactions = extractedData.transacciones.map((trans: any, index: number) => {
        const cleaned: any = {}
        
        if (trans.descripcion) {
          cleaned.descripcion = String(trans.descripcion).trim()
        }
        
        if (trans.monto) {
          const montoStr = String(trans.monto)
            .replace(/[^\d,.-]/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
          cleaned.monto = parseFloat(montoStr) || null
        }
        
        if (trans.moneda) {
          const moneda = String(trans.moneda).toUpperCase()
          cleaned.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
        } else {
          cleaned.moneda = 'ARS'
        }
        
        if (trans.fecha) {
          const fechaStr = String(trans.fecha)
          if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            cleaned.fecha = fechaStr
          } else {
            try {
              const fecha = new Date(fechaStr)
              if (!isNaN(fecha.getTime())) {
                cleaned.fecha = fecha.toISOString().split('T')[0]
              } else {
                cleaned.fecha = new Date().toISOString().split('T')[0]
              }
            } catch {
              cleaned.fecha = new Date().toISOString().split('T')[0]
            }
          }
        } else {
          cleaned.fecha = new Date().toISOString().split('T')[0]
        }
        
        if (trans.categoria) {
          cleaned.categoria = String(trans.categoria).trim()
        }
        
        if (trans.comercio) {
          cleaned.comercio = String(trans.comercio).trim()
        }
        
        if (trans.origen) {
          cleaned.origen = String(trans.origen).trim()
        }
        
        return cleaned
      }).filter((t: any) => t.descripcion && t.monto) // Filtrar transacciones válidas
      
      // Procesar total si existe
      const cleanedTotal: any = {}
      if (extractedData.total) {
        if (extractedData.total.monto) {
          const montoStr = String(extractedData.total.monto)
            .replace(/[^\d,.-]/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
          cleanedTotal.monto = parseFloat(montoStr) || null
        }
        if (extractedData.total.moneda) {
          const moneda = String(extractedData.total.moneda).toUpperCase()
          cleanedTotal.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
        }
        if (extractedData.total.periodo) {
          cleanedTotal.periodo = String(extractedData.total.periodo).trim()
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          transacciones: cleanedTransactions,
          total: Object.keys(cleanedTotal).length > 0 ? cleanedTotal : null,
          esResumen: true
        },
        rawResponse: text
      })
    }

    // Formato antiguo: transacción única (mantener compatibilidad)
    const cleanedData: any = {}
    
    if (extractedData.descripcion) {
      cleanedData.descripcion = String(extractedData.descripcion).trim()
    }
    
    if (extractedData.monto) {
      // Limpiar el monto: quitar símbolos, puntos de miles, comas decimales
      const montoStr = String(extractedData.monto)
        .replace(/[^\d,.-]/g, '') // Quitar todo excepto números, comas, puntos y guiones
        .replace(/\./g, '') // Quitar puntos (miles)
        .replace(',', '.') // Convertir coma decimal a punto
      cleanedData.monto = parseFloat(montoStr) || null
    }
    
    if (extractedData.moneda) {
      const moneda = String(extractedData.moneda).toUpperCase()
      cleanedData.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
    } else {
      cleanedData.moneda = 'ARS'
    }
    
    if (extractedData.fecha) {
      // Validar formato de fecha
      const fechaStr = String(extractedData.fecha)
      if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        cleanedData.fecha = fechaStr
      } else {
        // Intentar convertir fecha
        try {
          const fecha = new Date(fechaStr)
          if (!isNaN(fecha.getTime())) {
            cleanedData.fecha = fecha.toISOString().split('T')[0]
          } else {
            cleanedData.fecha = new Date().toISOString().split('T')[0]
          }
        } catch {
          cleanedData.fecha = new Date().toISOString().split('T')[0]
        }
      }
    } else {
      cleanedData.fecha = new Date().toISOString().split('T')[0]
    }
    
    if (extractedData.categoria) {
      cleanedData.categoria = String(extractedData.categoria).trim()
    }
    
    if (extractedData.comercio) {
      cleanedData.comercio = String(extractedData.comercio).trim()
    }
    
    if (extractedData.origen) {
      cleanedData.origen = String(extractedData.origen).trim()
    }

    return NextResponse.json({
      success: true,
      data: cleanedData,
      rawResponse: text
    })

  } catch (error: any) {
    console.error('❌ [API] Error procesando archivo:', error)
    console.error('❌ [API] Error stack:', error.stack)
    console.error('❌ [API] Error name:', error.name)
    console.error('❌ [API] Error message:', error.message)
    
    // Detectar errores específicos de Gemini
    let errorMessage = 'Error al procesar el archivo'
    let errorDetails = error.message || 'Error desconocido'
    
    if (error.message?.includes('API key')) {
      errorMessage = 'Error de autenticación con Google Gemini'
      errorDetails = 'Verifica que la API Key de Google Gemini esté configurada correctamente'
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      errorMessage = 'Límite de cuota excedido'
      errorDetails = 'Has alcanzado el límite de uso de la API de Google Gemini. Verifica tu cuota en Google Cloud Console.'
    } else if (error.message?.includes('size') || error.message?.includes('large')) {
      errorMessage = 'Archivo demasiado grande'
      errorDetails = 'El archivo es demasiado grande para procesar. Intenta con un archivo más pequeño o comprime el PDF.'
    } else if (error.message?.includes('PDF') || error.message?.includes('pdf')) {
      errorMessage = 'Error procesando PDF'
      errorDetails = error.message
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        errorType: error.name || 'UnknownError'
      },
      { status: 500 }
    )
  }
}
