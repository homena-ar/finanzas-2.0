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
        prompt = `Eres un experto en análisis de documentos financieros bancarios argentinos. Tu tarea es analizar este ${documentType} que es un resumen de tarjeta de crédito o resumen bancario y extraer información de forma precisa y profesional.

═══════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA SOBRE FORMATO DE NÚMEROS EN ARGENTINA ⚠️
═══════════════════════════════════════════════════════════════════

En Argentina el formato numérico es:
- PUNTO (.) = separador de MILES (miles, millones)
- COMA (,) = separador de DECIMALES (centavos)

ANÁLISIS PASO A PASO:
1. Identifica el último carácter decimal (generalmente una coma seguida de 2 dígitos)
2. Todo lo que está ANTES de la última coma son los enteros (pueden tener puntos de miles)
3. Los 2 dígitos DESPUÉS de la coma son los centavos

EJEMPLOS DE CONVERSIÓN (LEE CON CUIDADO):
- "15.179,99" = quince mil ciento setenta y nueve pesos con 99 centavos → 15179.99
- "1.517.999" = un millón quinientos diecisiete mil novecientos noventa y nueve pesos → 1517999.00
- "6.647,26" = seis mil seiscientos cuarenta y siete pesos con 26 centavos → 6647.26
- "664.726" = seiscientos sesenta y cuatro mil setecientos veintiséis pesos → 664726.00
- "3.600,00" = tres mil seiscientos pesos → 3600.00
- "13.662,00" = trece mil seiscientos sesenta y dos pesos → 13662.00
- "1.398,18" = mil trescientos noventa y ocho pesos con 18 centavos → 1398.18
- "139.818" = ciento treinta y nueve mil ochocientos dieciocho pesos → 139818.00
- "40.487,43" = cuarenta mil cuatrocientos ochenta y siete pesos con 43 centavos → 40487.43

REGLAS PARA DETECTAR DECIMALES:
- Si el número termina en ",XX" donde XX son 2 dígitos → la coma es decimal
- Si no hay coma al final → el número es entero (sin decimales)
- Si hay puntos internos sin coma al final → son puntos de miles, NO decimales

═══════════════════════════════════════════════════════════════════
📋 INFORMACIÓN A EXTRAER
═══════════════════════════════════════════════════════════════════

1. INFORMACIÓN DE LA TARJETA (busca en encabezados, logos, números):
   - banco: nombre del banco emisor (ej: "BBVA", "Banco Nación", "Galicia")
   - tipo_tarjeta: tipo si es visible (ej: "Visa", "Mastercard", "Amex", o "CreditCard")
   - ultimos_digitos: últimos 4-6 dígitos de la tarjeta si están visibles
   - nombre_titular: nombre del titular si está visible

2. CONSUMOS DEL PERÍODO ACTUAL:
   - SOLO extrae CONSUMOS individuales del período actual
   - NO incluyas pagos de meses anteriores (ej: "SU PAGO EN PESOS")
   - NO incluyas saldos anteriores, intereses, comisiones o impuestos como transacciones
   - Busca la sección titulada "Consumos", "Detalle de Consumos" o similar

3. TOTALES:
   - Extrae el total de consumos del período si está visible
   - Extrae información del período de cierre/vencimiento

═══════════════════════════════════════════════════════════════════
📤 FORMATO DE RESPUESTA JSON
═══════════════════════════════════════════════════════════════════

{
  "tarjeta": {
    "banco": "nombre del banco o null si no se encuentra",
    "tipo_tarjeta": "Visa/Mastercard/Amex/CreditCard u otro, o null",
    "ultimos_digitos": "últimos dígitos visibles o null",
    "nombre_titular": "nombre del titular si está visible o null"
  },
  "transacciones": [
    {
      "descripcion": "descripción exacta del consumo (ej: nombre del comercio, descripción del consumo)",
      "monto": número decimal usando PUNTO (.) como separador decimal, SIN puntos de miles (ej: 15179.99, 6647.26, 3600.00),
      "moneda": "ARS" o "USD" según corresponda,
      "fecha": "YYYY-MM-DD" (fecha del consumo individual del período actual, formato ISO),
      "categoria": "categoría sugerida según la descripción (ej: Transporte, Telefonía/Internet, Supermercado, etc.)",
      "comercio": "nombre del comercio o establecimiento si está disponible o null"
    }
  ],
  "total": {
    "monto": número decimal (total de consumos del período si está visible, formato estándar con punto decimal, SIN puntos de miles),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen (ej: '2025-11-20' o 'Noviembre 2025')"
  }
}

═══════════════════════════════════════════════════════════════════
✅ EJEMPLOS DE CONVERSIÓN CORRECTA
═══════════════════════════════════════════════════════════════════

Entrada en documento: "15.179,99" → Salida en JSON: 15179.99
Entrada en documento: "6.647,26" → Salida en JSON: 6647.26
Entrada en documento: "3.600,00" → Salida en JSON: 3600.00
Entrada en documento: "13.662,00" → Salida en JSON: 13662.00
Entrada en documento: "1.398,18" → Salida en JSON: 1398.18
Entrada en documento: "40.487,43" → Salida en JSON: 40487.43

═══════════════════════════════════════════════════════════════════
🎯 IMPORTANTE
═══════════════════════════════════════════════════════════════════

- Lee cada número CAREFULMENTE, identificando dónde están los decimales
- Si el número tiene coma al final con 2 dígitos → es decimal
- Convierte TODOS los montos a formato estándar (punto decimal, sin puntos de miles)
- Solo incluye CONSUMOS del período actual, NO pagos ni ajustes anteriores
- Las fechas deben estar en formato YYYY-MM-DD

Analiza el documento paso a paso y responde SOLO con el JSON, sin texto adicional.`
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

IMPORTANTE CRÍTICO SOBRE FORMATO DE NÚMEROS:
- En Argentina se usa COMA (,) para decimales y PUNTO (.) para miles
- Ejemplo: "15.179,99" significa quince mil ciento setenta y nueve pesos con 99 centavos = 15179.99 (no 1517999)
- Ejemplo: "1.500,50" significa mil quinientos pesos con 50 centavos = 1500.50 (no 150050)
- Convierte TODOS los montos a formato numérico estándar usando punto (.) para decimales y SIN puntos de miles

IMPORTANTE SOBRE FILTRADO:
- NO incluyas transferencias o depósitos de meses anteriores
- SOLO extrae ingresos del período actual del resumen
- Busca la sección de ingresos o transacciones del período vigente

Responde en formato JSON con un array "transacciones" que contenga cada ingreso individual encontrado:

{
  "transacciones": [
    {
      "descripcion": "descripción del ingreso individual (ej: Salario, Transferencia, Depósito, etc.)",
      "monto": número decimal usando punto (.) como separador decimal, sin puntos de miles (ej: 15179.99, 1500.50),
      "moneda": "ARS" o "USD",
      "fecha": "YYYY-MM-DD" (fecha del ingreso individual del período actual),
      "categoria": "categoría sugerida según la descripción (ej: Salario, Freelance, Inversiones, etc.)",
      "origen": "origen del ingreso (banco, empresa, persona, etc.)"
    }
  ],
  "total": {
    "monto": número decimal (total de ingresos del período si está visible, formato estándar con punto decimal),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen"
  }
}

EJEMPLOS DE CONVERSIÓN CORRECTA:
- "15.179,99" → 15179.99
- "1.500,50" → 1500.50
- "50.000,00" → 50000.00

Si encuentras múltiples ingresos del período actual, inclúyelos todos en el array. NO incluyas ingresos de períodos anteriores. Las fechas deben estar en formato YYYY-MM-DD.`
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
      
      // Función mejorada para convertir montos argentinos
      const parseMontoArgentino = (monto: any): number | null => {
        if (!monto) return null
        
        const montoStr = String(monto).trim()
        
        // Si ya es un número válido, devolverlo
        if (typeof monto === 'number' && !isNaN(monto)) {
          return monto
        }
        
        // Remover símbolos de moneda y espacios
        let cleaned = montoStr.replace(/[^\d,.-]/g, '').trim()
        
        // Detectar si tiene coma decimal (formato argentino: 15.179,99)
        if (cleaned.includes(',')) {
          // Separar por coma
          const parts = cleaned.split(',')
          if (parts.length === 2) {
            // La coma es decimal, quitar puntos de miles y usar punto decimal
            const enteros = parts[0].replace(/\./g, '')
            const decimales = parts[1].padEnd(2, '0').substring(0, 2) // Asegurar 2 decimales
            return parseFloat(`${enteros}.${decimales}`)
          }
        }
        
        // Si no tiene coma pero tiene puntos, pueden ser miles (formato: 1517999 o 1.517.999)
        if (cleaned.includes('.')) {
          // Contar puntos - si hay muchos, probablemente son miles
          const puntos = (cleaned.match(/\./g) || []).length
          if (puntos > 0) {
            // Quitar puntos y tratar como número entero
            cleaned = cleaned.replace(/\./g, '')
          }
        }
        
        const result = parseFloat(cleaned)
        return isNaN(result) ? null : result
      }
      
      // Procesar cada transacción individual
      const cleanedTransactions = extractedData.transacciones.map((trans: any, index: number) => {
        const cleaned: any = {}
        
        if (trans.descripcion) {
          cleaned.descripcion = String(trans.descripcion).trim()
        }
        
        if (trans.monto) {
          cleaned.monto = parseMontoArgentino(trans.monto)
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
          cleanedTotal.monto = parseMontoArgentino(extractedData.total.monto)
        }
        if (extractedData.total.moneda) {
          const moneda = String(extractedData.total.moneda).toUpperCase()
          cleanedTotal.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
        }
        if (extractedData.total.periodo) {
          cleanedTotal.periodo = String(extractedData.total.periodo).trim()
        }
      }
      
      // Procesar información de tarjeta si existe
      const cleanedTarjeta: any = {}
      if (extractedData.tarjeta) {
        if (extractedData.tarjeta.banco) {
          cleanedTarjeta.banco = String(extractedData.tarjeta.banco).trim()
        }
        if (extractedData.tarjeta.tipo_tarjeta) {
          cleanedTarjeta.tipo_tarjeta = String(extractedData.tarjeta.tipo_tarjeta).trim()
        }
        if (extractedData.tarjeta.ultimos_digitos) {
          cleanedTarjeta.ultimos_digitos = String(extractedData.tarjeta.ultimos_digitos).trim()
        }
        if (extractedData.tarjeta.nombre_titular) {
          cleanedTarjeta.nombre_titular = String(extractedData.tarjeta.nombre_titular).trim()
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          transacciones: cleanedTransactions,
          total: Object.keys(cleanedTotal).length > 0 ? cleanedTotal : null,
          tarjeta: Object.keys(cleanedTarjeta).length > 0 ? cleanedTarjeta : null,
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
