import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, type, mimeType } = body // type: 'gasto' | 'ingreso' | 'resumen'

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    // Determinar si es PDF o imagen
    const isPDF = mimeType === 'application/pdf' || imageBase64.includes('data:application/pdf')
    const isImage = imageBase64.includes('data:image/') || !isPDF

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Determinar el prompt según el tipo
    let prompt = ''
    const documentType = isPDF ? 'documento PDF' : 'imagen'
    if (type === 'gasto' || type === 'comprobante') {
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
    } else if (type === 'ingreso' || type === 'resumen') {
      prompt = `Analiza este ${documentType} de un resumen bancario, extracto o comprobante de ingreso y extrae la siguiente información en formato JSON:

{
  "descripcion": "descripción del ingreso (ej: Salario, Transferencia, Depósito, etc.)",
  "monto": número (solo el número, sin símbolos),
  "moneda": "ARS" o "USD",
  "fecha": "YYYY-MM-DD" (fecha del ingreso, si no está visible usa la fecha actual),
  "categoria": "categoría sugerida (ej: Salario, Freelance, Inversiones, etc.)",
  "origen": "origen del ingreso (banco, empresa, etc.)"
}

Si no puedes identificar algún campo, usa null. Asegúrate de que el monto sea solo el número sin símbolos de moneda ni puntos de miles. La fecha debe estar en formato YYYY-MM-DD.`
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
      // Para PDFs
      fileData = imageBase64.replace(/^data:application\/pdf;base64,/, '')
      detectedMimeType = 'application/pdf'
    } else {
      // Para imágenes
      const imageMatch = imageBase64.match(/data:image\/(\w+);base64,/)
      fileData = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      detectedMimeType = imageMatch ? `image/${imageMatch[1]}` : 'image/jpeg'
    }

    // Usar el mimeType proporcionado o el detectado
    const finalMimeType = mimeType || detectedMimeType

    const filePart = {
      inlineData: {
        data: fileData,
        mimeType: finalMimeType
      }
    }

    // Llamar a Gemini
    const result = await model.generateContent([prompt, filePart])
    const response = await result.response
    const text = response.text()

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
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError)
      console.error('Response text:', text)
      return NextResponse.json(
        { 
          error: 'No se pudo extraer información estructurada de la imagen',
          rawResponse: text 
        },
        { status: 500 }
      )
    }

    // Validar y limpiar los datos
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
    return NextResponse.json(
      {
        error: 'Error al procesar el archivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}
